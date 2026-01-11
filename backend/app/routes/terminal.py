"""Real-time terminal WebSocket endpoint"""
import asyncio
import json
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.orm import Session
import docker
from docker.errors import APIError

from .. import models, auth
from ..database import get_db

router = APIRouter(prefix="/terminal", tags=["terminal"])


class TerminalSession:
    """Manages a Docker container terminal session"""

    def __init__(self, container, exec_id, socket):
        self.container = container
        self.exec_id = exec_id
        self.socket = socket
        self._closed = False

    async def read_output(self, websocket: WebSocket):
        """Read output from container and send to WebSocket"""
        try:
            while not self._closed:
                # Read from socket in chunks
                data = self.socket._sock.recv(4096)
                if not data:
                    break
                # Send raw bytes as text (terminal escape sequences included)
                await websocket.send_text(data.decode("utf-8", errors="replace"))
        except Exception:
            pass

    def write_input(self, data: str):
        """Write input to container"""
        if not self._closed:
            try:
                self.socket._sock.send(data.encode("utf-8"))
            except Exception:
                pass

    def resize(self, rows: int, cols: int):
        """Resize terminal"""
        if not self._closed:
            try:
                client = docker.from_env()
                client.api.exec_resize(self.exec_id, height=rows, width=cols)
            except Exception:
                pass

    def close(self):
        """Close the session"""
        self._closed = True
        try:
            self.socket.close()
        except Exception:
            pass
        try:
            self.container.stop(timeout=1)
            self.container.remove(force=True)
        except Exception:
            pass


async def verify_token(token: str, db: Session) -> Optional[models.User]:
    """Verify JWT token and return user"""
    from ..auth import decode_token
    token_data = decode_token(token)
    if not token_data or not token_data.user_id:
        return None
    return db.query(models.User).filter(models.User.id == token_data.user_id).first()


@router.websocket("/ws/{enrollment_id}")
async def terminal_websocket(
    websocket: WebSocket,
    enrollment_id: int,
    token: str = Query(...),
):
    """WebSocket endpoint for interactive terminal"""
    await websocket.accept()

    # Get database session
    from ..database import SessionLocal
    db = SessionLocal()

    try:
        # Verify token
        user = await verify_token(token, db)
        if not user:
            await websocket.send_json({"type": "error", "message": "Invalid token"})
            await websocket.close(code=4001)
            return

        # Get enrollment
        enrollment = db.query(models.Enrollment).filter(
            models.Enrollment.id == enrollment_id,
            models.Enrollment.user_id == user.id
        ).first()

        if not enrollment:
            await websocket.send_json({"type": "error", "message": "Enrollment not found"})
            await websocket.close(code=4004)
            return

        # Get track
        track = db.query(models.Track).filter(
            models.Track.id == enrollment.track_id
        ).first()

        if not track:
            await websocket.send_json({"type": "error", "message": "Track not found"})
            await websocket.close(code=4004)
            return

        # Create Docker container with interactive shell
        client = docker.from_env()
        docker_image = track.docker_image or "livelabs-runner:latest"

        try:
            container = client.containers.run(
                docker_image,
                command="/bin/bash",
                stdin_open=True,
                tty=True,
                detach=True,
                environment=track.env_secrets or {},
                network_mode="bridge",
                mem_limit="512m",
                cpu_period=100000,
                cpu_quota=50000,
            )
        except Exception as e:
            await websocket.send_json({"type": "error", "message": f"Failed to start container: {str(e)}"})
            await websocket.close(code=4500)
            return

        # Create exec instance for interactive session
        try:
            exec_id = client.api.exec_create(
                container.id,
                "/bin/bash",
                stdin=True,
                tty=True,
                stdout=True,
                stderr=True,
            )["Id"]

            socket = client.api.exec_start(
                exec_id,
                socket=True,
                tty=True,
            )
        except Exception as e:
            container.remove(force=True)
            await websocket.send_json({"type": "error", "message": f"Failed to start shell: {str(e)}"})
            await websocket.close(code=4500)
            return

        session = TerminalSession(container, exec_id, socket)

        # Send ready message
        await websocket.send_json({"type": "ready", "message": "Terminal connected"})

        # Start reading output in background
        read_task = asyncio.create_task(session.read_output(websocket))

        try:
            while True:
                # Receive messages from client
                message = await websocket.receive_text()
                data = json.loads(message)

                if data["type"] == "input":
                    session.write_input(data["data"])
                elif data["type"] == "resize":
                    session.resize(data["rows"], data["cols"])
                elif data["type"] == "close":
                    break

        except WebSocketDisconnect:
            pass
        finally:
            read_task.cancel()
            session.close()

    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
    finally:
        db.close()
        try:
            await websocket.close()
        except Exception:
            pass
