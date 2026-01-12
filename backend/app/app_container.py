"""
AppContainerManager - Manages background Docker containers for lab apps.

Supports running Docker apps with port mapping for lab experiences,
allowing learners to interact with real applications in the browser.
"""
import socket
import time
from datetime import datetime
from typing import Optional
import docker
from docker.errors import ImageNotFound, APIError, NotFound
from sqlalchemy.orm import Session

from .models import AppContainer, Enrollment, Track


class AppContainerManager:
    def __init__(self):
        self._client = None
        self.container_prefix = "livelabs-app-"
        self.max_restarts = 3
        self.health_timeout = 30  # seconds to wait for health check

    @property
    def client(self):
        """Lazy initialization of Docker client"""
        if self._client is None:
            self._client = docker.from_env()
        return self._client

    def _get_container_name(self, enrollment_id: int) -> str:
        """Generate container name for enrollment"""
        return f"{self.container_prefix}{enrollment_id}"

    def _find_free_port(self) -> int:
        """Find a free port on the host"""
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(('', 0))
            s.listen(1)
            return s.getsockname()[1]

    def _check_port_health(self, port: int, timeout: float = 5.0) -> bool:
        """Check if a port is accepting connections"""
        start = time.time()
        while time.time() - start < timeout:
            try:
                with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                    s.settimeout(1)
                    s.connect(('localhost', port))
                    return True
            except (socket.error, socket.timeout):
                time.sleep(0.5)
        return False

    def start_container(
        self,
        db: Session,
        enrollment: Enrollment
    ) -> Optional[AppContainer]:
        """
        Start app container for enrollment.
        Returns AppContainer record or None if track has no app container config.
        """
        track = enrollment.track

        if not track.app_container_image:
            return None

        # Check if container already exists
        existing = db.query(AppContainer).filter(
            AppContainer.enrollment_id == enrollment.id
        ).first()

        if existing:
            # Try to reuse or restart
            return self._ensure_running(db, existing, track)

        # Build port mappings
        port_config = track.app_container_ports or []
        ports = {}
        port_bindings = {}

        for port_def in port_config:
            container_port = port_def.get("container")
            host_port = port_def.get("host")

            if container_port:
                port_key = f"{container_port}/tcp"
                if host_port is None:
                    host_port = self._find_free_port()
                ports[port_key] = host_port
                port_bindings[port_key] = [{"HostPort": str(host_port)}]

        # Build environment
        env = dict(track.env_secrets or {})
        env.update(track.app_container_env or {})
        env.update(enrollment.environment or {})

        container_name = self._get_container_name(enrollment.id)

        try:
            # Remove any stale container with same name
            try:
                old = self.client.containers.get(container_name)
                old.remove(force=True)
            except NotFound:
                pass

            # Build run arguments
            run_kwargs = {
                "image": track.app_container_image,
                "name": container_name,
                "detach": True,
                "environment": env,
                "ports": port_bindings,
                "mem_limit": "1g",
                "cpu_period": 100000,
                "cpu_quota": 100000,  # 100% of one CPU
                "restart_policy": {"Name": "on-failure", "MaximumRetryCount": 3},
            }

            if track.app_container_command:
                run_kwargs["command"] = track.app_container_command

            container = self.client.containers.run(**run_kwargs)

            # Store port mapping as {container_port: host_port}
            port_map = {}
            for port_def in port_config:
                container_port = port_def.get("container")
                if container_port:
                    port_key = f"{container_port}/tcp"
                    port_map[str(container_port)] = ports.get(port_key)

            # Create DB record
            app_container = AppContainer(
                enrollment_id=enrollment.id,
                container_id=container.id,
                status="starting",
                ports=port_map,
                started_at=datetime.utcnow(),
            )
            db.add(app_container)
            db.commit()
            db.refresh(app_container)

            # Wait for container to be healthy
            self._wait_for_health(db, app_container, port_map)

            return app_container

        except ImageNotFound:
            raise ValueError(f"Docker image not found: {track.app_container_image}")
        except APIError as e:
            raise ValueError(f"Docker API error: {str(e)}")

    def _ensure_running(
        self,
        db: Session,
        app_container: AppContainer,
        track: Track
    ) -> AppContainer:
        """Ensure container is running, restart if needed"""
        try:
            container = self.client.containers.get(app_container.container_id)
            status = container.status

            if status == "running":
                app_container.status = "running"
                app_container.last_health_check = datetime.utcnow()
                db.commit()
                return app_container

            if status in ("exited", "dead"):
                container.start()
                app_container.status = "running"
                app_container.restart_count += 1
                app_container.last_health_check = datetime.utcnow()
                db.commit()
                return app_container

        except NotFound:
            # Container was removed, delete record and start fresh
            db.delete(app_container)
            db.commit()
            enrollment = db.query(Enrollment).get(app_container.enrollment_id)
            return self.start_container(db, enrollment)
        except APIError as e:
            app_container.status = "failed"
            db.commit()
            raise ValueError(f"Failed to restart container: {str(e)}")

        return app_container

    def _wait_for_health(
        self,
        db: Session,
        app_container: AppContainer,
        port_map: dict
    ):
        """Wait for container to accept connections on first mapped port"""
        if not port_map:
            app_container.status = "running"
            app_container.last_health_check = datetime.utcnow()
            db.commit()
            return

        # Get first port
        first_port = list(port_map.values())[0]
        if first_port and self._check_port_health(first_port, self.health_timeout):
            app_container.status = "running"
        else:
            app_container.status = "running"  # Still mark running, may just need more time

        app_container.last_health_check = datetime.utcnow()
        db.commit()

    def stop_container(self, db: Session, enrollment_id: int) -> bool:
        """Stop and remove app container for enrollment"""
        app_container = db.query(AppContainer).filter(
            AppContainer.enrollment_id == enrollment_id
        ).first()

        if not app_container:
            return True

        try:
            container = self.client.containers.get(app_container.container_id)
            container.stop(timeout=10)
            container.remove(force=True)
        except NotFound:
            pass
        except APIError:
            pass

        db.delete(app_container)
        db.commit()
        return True

    def restart_container(self, db: Session, enrollment_id: int) -> Optional[AppContainer]:
        """Restart app container for enrollment"""
        app_container = db.query(AppContainer).filter(
            AppContainer.enrollment_id == enrollment_id
        ).first()

        if not app_container:
            enrollment = db.query(Enrollment).get(enrollment_id)
            if enrollment:
                return self.start_container(db, enrollment)
            return None

        if app_container.restart_count >= self.max_restarts:
            # Full restart - remove and recreate
            self.stop_container(db, enrollment_id)
            enrollment = db.query(Enrollment).get(enrollment_id)
            if enrollment:
                return self.start_container(db, enrollment)
            return None

        try:
            container = self.client.containers.get(app_container.container_id)
            container.restart(timeout=10)
            app_container.status = "running"
            app_container.restart_count += 1
            app_container.last_health_check = datetime.utcnow()
            db.commit()
            return app_container
        except NotFound:
            # Container gone, recreate
            db.delete(app_container)
            db.commit()
            enrollment = db.query(Enrollment).get(enrollment_id)
            if enrollment:
                return self.start_container(db, enrollment)
            return None
        except APIError as e:
            app_container.status = "failed"
            db.commit()
            raise ValueError(f"Failed to restart: {str(e)}")

    def get_status(self, db: Session, enrollment_id: int) -> dict:
        """Get app container status for enrollment"""
        app_container = db.query(AppContainer).filter(
            AppContainer.enrollment_id == enrollment_id
        ).first()

        enrollment = db.query(Enrollment).get(enrollment_id)
        if not enrollment:
            return {"status": "error", "message": "Enrollment not found"}

        track = enrollment.track

        # No app container configured
        if not track.app_container_image and not track.app_url_template:
            return {
                "status": "no_app",
                "has_app": False,
            }

        # External URL only (no Docker container)
        if track.app_url_template and not track.app_container_image:
            return {
                "status": "external",
                "has_app": True,
                "url": self._build_app_url(track, None),
                "type": "external",
            }

        # Docker container
        if not app_container:
            return {
                "status": "stopped",
                "has_app": True,
                "type": "container",
                "can_start": True,
            }

        # Check actual container status
        try:
            container = self.client.containers.get(app_container.container_id)
            actual_status = container.status

            if actual_status != "running" and app_container.status == "running":
                app_container.status = actual_status
                db.commit()

        except NotFound:
            # Container gone
            db.delete(app_container)
            db.commit()
            return {
                "status": "stopped",
                "has_app": True,
                "type": "container",
                "can_start": True,
            }
        except APIError:
            pass

        url = self._build_app_url(track, app_container.ports) if app_container.status == "running" else None

        return {
            "status": app_container.status,
            "has_app": True,
            "type": "container",
            "url": url,
            "ports": app_container.ports,
            "can_restart": app_container.restart_count < self.max_restarts,
            "restart_count": app_container.restart_count,
            "started_at": app_container.started_at.isoformat() if app_container.started_at else None,
        }

    def _build_app_url(self, track: Track, ports: Optional[dict]) -> Optional[str]:
        """Build app URL with port substitution and auto-login params"""
        template = track.app_url_template
        if not template:
            if ports:
                # Default to first port
                first_port = list(ports.values())[0]
                template = f"http://localhost:{first_port}"
            else:
                return None

        # Substitute {port} placeholder
        if ports and "{port}" in template:
            first_port = list(ports.values())[0]
            template = template.replace("{port}", str(first_port))

        # Substitute specific ports like {port:8080}
        if ports:
            for container_port, host_port in ports.items():
                template = template.replace(f"{{port:{container_port}}}", str(host_port))

        # Add auto-login URL params
        if track.auto_login_type == "url_params" and track.auto_login_config:
            params = track.auto_login_config.get("params", {})
            if params:
                separator = "&" if "?" in template else "?"
                param_str = "&".join(f"{k}={v}" for k, v in params.items())
                template = f"{template}{separator}{param_str}"

        return template

    def get_auto_login_cookies(self, track: Track) -> list:
        """Get cookies to inject for auto-login (if configured)"""
        if track.auto_login_type != "cookies":
            return []
        return track.auto_login_config.get("cookies", [])


# Global instance
app_container_manager = AppContainerManager()
