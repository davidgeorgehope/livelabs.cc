"""
App Container API routes - manages Docker containers for lab apps.
"""
import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, auth
from ..app_container import app_container_manager
from ..runner import runner

router = APIRouter(prefix="/enrollments/{enrollment_id}/app", tags=["app-container"])


def get_enrollment_or_404(
    enrollment_id: int,
    db: Session,
    current_user: models.User
) -> models.Enrollment:
    """Get enrollment and verify ownership"""
    enrollment = db.query(models.Enrollment).filter(
        models.Enrollment.id == enrollment_id
    ).first()

    if not enrollment:
        raise HTTPException(status_code=404, detail="models.Enrollment not found")

    if enrollment.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    return enrollment


@router.get("")
def get_app_status(
    enrollment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Get app status for enrollment.
    Checks init status first, then returns URL from cache or container.
    """
    enrollment = get_enrollment_or_404(enrollment_id, db, current_user)
    track = enrollment.track

    # Check if track has any app configuration
    has_init_script = track.init_script and track.init_script.strip()
    has_app = bool(has_init_script or track.app_url_template or track.app_container_image)

    if not has_app:
        return {
            "status": "no_app",
            "has_app": False,
        }

    # Step 1: If init_script exists, it must run first (for setup purposes)
    if has_init_script:
        if enrollment.init_status == "pending":
            return {
                "status": "needs_init",
                "has_app": True,
            }

        if enrollment.init_status == "running":
            return {
                "status": "initializing",
                "has_app": True,
            }

        if enrollment.init_status == "failed":
            # If we have a configured URL, show it anyway (init failure is non-blocking)
            # Otherwise report the failure
            if not track.app_url_template:
                return {
                    "status": "init_failed",
                    "has_app": True,
                    "error": enrollment.init_error,
                }
            # Fall through to show configured URL despite init failure
        # init_status == "success" or failed-but-has-url - fall through to URL logic

    # Step 2: Determine URL (init either succeeded or wasn't needed)
    # Priority: app_url_template > init_script output > app_container
    url = None
    cookies = []

    if track.app_url_template:
        # Configured URL takes priority
        url = track.app_url_template

        # Add auto-login params
        if track.auto_login_type == "url_params" and track.auto_login_config:
            params = track.auto_login_config.get("params", {})
            if params:
                separator = "&" if "?" in url else "?"
                param_str = "&".join(f"{k}={v}" for k, v in params.items())
                url = f"{url}{separator}{param_str}"

        # Add cookies
        if track.auto_login_type == "cookies" and track.auto_login_config:
            cookies = track.auto_login_config.get("cookies", [])

    elif has_init_script and enrollment.app_url:
        # Use URL from init script output
        url = enrollment.app_url
        cookies = enrollment.app_cookies or []

    elif track.app_container_image:
        # Use Docker container
        status = app_container_manager.get_status(db, enrollment_id)
        if status.get("has_app"):
            status["cookies"] = app_container_manager.get_auto_login_cookies(track)
        return status

    if url:
        return {
            "status": "ready",
            "has_app": True,
            "url": url,
            "cookies": cookies,
            "type": "external",
        }

    # No URL available
    return {"status": "no_app", "has_app": False}


@router.post("/init")
def run_init(
    enrollment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Run the track's initialization script.
    - Only runs if init_status is 'pending' or 'failed'
    - Parses JSON output for {url, cookies}
    - Stores results on enrollment
    """
    enrollment = get_enrollment_or_404(enrollment_id, db, current_user)
    track = enrollment.track

    # No init script - use static config
    if not track.init_script or not track.init_script.strip():
        enrollment.app_url = track.app_url_template
        enrollment.init_status = "success"
        enrollment.init_completed_at = datetime.utcnow()
        db.commit()
        return {
            "status": "success",
            "url": track.app_url_template,
            "cookies": [],
        }

    # Already initialized successfully
    if enrollment.init_status == "success":
        return {
            "status": "success",
            "url": enrollment.app_url,
            "cookies": enrollment.app_cookies or [],
        }

    # Already running (in another request)
    if enrollment.init_status == "running":
        return {
            "status": "running",
            "message": "Initialization already in progress",
        }

    # Mark as running
    enrollment.init_status = "running"
    enrollment.init_error = None
    db.commit()

    try:
        # Run init script
        result = runner.run_script(
            script=track.init_script,
            environment=track.env_secrets or {},
            docker_image=track.docker_image
        )

        if not result["success"]:
            enrollment.init_status = "failed"
            enrollment.init_error = result["stderr"] or f"Script exited with code {result['exit_code']}"
            db.commit()
            return {
                "status": "failed",
                "error": enrollment.init_error,
            }

        # Parse JSON from stdout
        stdout = result["stdout"].strip()

        # Try to find JSON in output (may have other output before it)
        json_start = stdout.rfind("{")
        if json_start >= 0:
            stdout = stdout[json_start:]

        try:
            data = json.loads(stdout)
        except json.JSONDecodeError as e:
            enrollment.init_status = "failed"
            enrollment.init_error = f"Invalid JSON output: {str(e)}\nOutput: {result['stdout'][:500]}"
            db.commit()
            return {
                "status": "failed",
                "error": enrollment.init_error,
            }

        # Extract URL and cookies
        url = data.get("url")
        cookies = data.get("cookies", [])

        if not url:
            enrollment.init_status = "failed"
            enrollment.init_error = "Init script did not return a 'url' in JSON output"
            db.commit()
            return {
                "status": "failed",
                "error": enrollment.init_error,
            }

        # Success - save to enrollment
        enrollment.app_url = url
        enrollment.app_cookies = cookies
        enrollment.init_status = "success"
        enrollment.init_completed_at = datetime.utcnow()
        db.commit()

        return {
            "status": "success",
            "url": url,
            "cookies": cookies,
        }

    except Exception as e:
        enrollment.init_status = "failed"
        enrollment.init_error = f"Unexpected error: {str(e)}"
        db.commit()
        return {
            "status": "failed",
            "error": enrollment.init_error,
        }


@router.post("/start")
def start_app_container(
    enrollment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Start app container for enrollment.
    Only works if track has app_container_image configured.
    """
    enrollment = get_enrollment_or_404(enrollment_id, db, current_user)

    if not enrollment.track.app_container_image:
        raise HTTPException(
            status_code=400,
            detail="This track does not have an app container configured"
        )

    try:
        app_container_manager.start_container(db, enrollment)
        return app_container_manager.get_status(db, enrollment_id)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/restart")
def restart_app_container(
    enrollment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Restart app container for enrollment.
    """
    enrollment = get_enrollment_or_404(enrollment_id, db, current_user)

    if not enrollment.track.app_container_image:
        raise HTTPException(
            status_code=400,
            detail="This track does not have an app container configured"
        )

    try:
        app_container_manager.restart_container(db, enrollment_id)
        return app_container_manager.get_status(db, enrollment_id)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stop")
def stop_app_container(
    enrollment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Stop app container for enrollment.
    """
    enrollment = get_enrollment_or_404(enrollment_id, db, current_user)

    app_container_manager.stop_container(db, enrollment_id)
    return {"status": "stopped", "message": "Container stopped successfully"}
