import time
import logging
from datetime import datetime
import docker
from docker.errors import ContainerError, ImageNotFound, APIError

logger = logging.getLogger(__name__)


class ScriptRunner:
    def __init__(self):
        self._client = None
        self.timeout = 300  # 5 minutes

    @property
    def client(self):
        """Lazy initialization of Docker client"""
        if self._client is None:
            self._client = docker.from_env()
        return self._client

    def run_script(
        self,
        script: str,
        environment: dict[str, str],
        docker_image: str = "livelabs-runner:latest",
        user_id: int = None,
        script_type: str = None
    ) -> dict:
        """
        Run a script in a Docker container with security hardening.

        Returns:
            dict with keys: success, stdout, stderr, exit_code, duration_ms
        """
        start_time = time.time()
        container_id = None

        # Log script execution
        script_preview = script[:200] + "..." if len(script) > 200 else script
        logger.info(
            f"Script execution started | user_id={user_id} | type={script_type} | "
            f"image={docker_image} | script_preview={script_preview!r}"
        )

        if not script.strip():
            logger.info(f"Script execution skipped (empty) | user_id={user_id}")
            return {
                "success": True,
                "stdout": "",
                "stderr": "",
                "exit_code": 0,
                "duration_ms": 0
            }

        container = None
        try:
            # Run the container
            container = self.client.containers.run(
                docker_image,
                command=["bash", "-c", script],
                environment=environment,
                detach=True,
                remove=False,
                network_mode="bridge",
                mem_limit="512m",
                cpu_period=100000,
                cpu_quota=50000,  # 50% of one CPU
            )
            container_id = container.id

            # Wait for completion with timeout
            result = container.wait(timeout=self.timeout)
            exit_code = result.get("StatusCode", 1)

            # Get logs
            stdout = container.logs(stdout=True, stderr=False).decode("utf-8", errors="replace")
            stderr = container.logs(stdout=False, stderr=True).decode("utf-8", errors="replace")

            duration_ms = int((time.time() - start_time) * 1000)

            # Log completion
            logger.info(
                f"Script execution completed | user_id={user_id} | container_id={container_id} | "
                f"exit_code={exit_code} | duration_ms={duration_ms} | success={exit_code == 0}"
            )

            return {
                "success": exit_code == 0,
                "stdout": stdout,
                "stderr": stderr,
                "exit_code": exit_code,
                "duration_ms": duration_ms
            }

        except ContainerError as e:
            duration_ms = int((time.time() - start_time) * 1000)
            logger.warning(
                f"Script container error | user_id={user_id} | container_id={container_id} | "
                f"exit_code={e.exit_status} | duration_ms={duration_ms}"
            )
            return {
                "success": False,
                "stdout": e.stdout.decode("utf-8", errors="replace") if e.stdout else "",
                "stderr": e.stderr.decode("utf-8", errors="replace") if e.stderr else str(e),
                "exit_code": e.exit_status,
                "duration_ms": duration_ms
            }

        except ImageNotFound:
            duration_ms = int((time.time() - start_time) * 1000)
            logger.error(
                f"Script execution failed - image not found | user_id={user_id} | image={docker_image}"
            )
            return {
                "success": False,
                "stdout": "",
                "stderr": f"Docker image not found: {docker_image}",
                "exit_code": 1,
                "duration_ms": duration_ms
            }

        except APIError as e:
            duration_ms = int((time.time() - start_time) * 1000)
            logger.error(
                f"Script execution failed - Docker API error | user_id={user_id} | error={str(e)}"
            )
            return {
                "success": False,
                "stdout": "",
                "stderr": f"Docker API error: {str(e)}",
                "exit_code": 1,
                "duration_ms": duration_ms
            }

        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            logger.error(
                f"Script execution failed - unexpected error | user_id={user_id} | error={str(e)}"
            )
            return {
                "success": False,
                "stdout": "",
                "stderr": f"Execution error: {str(e)}",
                "exit_code": 1,
                "duration_ms": duration_ms
            }

        finally:
            # Clean up container
            if container:
                try:
                    container.remove(force=True)
                except Exception:
                    pass


# Global runner instance
runner = ScriptRunner()
