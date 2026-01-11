from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from .. import models, schemas, auth
from ..database import get_db
from ..runner import runner

router = APIRouter(prefix="/enrollments/{enrollment_id}/steps/{step_order}/execute", tags=["execution"])


@router.post("", response_model=schemas.ExecutionResult)
def execute_script(
    enrollment_id: int,
    step_order: int,
    execution_data: schemas.ExecutionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Get enrollment
    enrollment = db.query(models.Enrollment).filter(
        models.Enrollment.id == enrollment_id,
        models.Enrollment.user_id == current_user.id
    ).first()

    if not enrollment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Enrollment not found"
        )

    # Get track
    track = db.query(models.Track).filter(
        models.Track.id == enrollment.track_id
    ).first()

    # Get step
    step = db.query(models.Step).filter(
        models.Step.track_id == track.id,
        models.Step.order == step_order
    ).first()

    if not step:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Step not found"
        )

    # Only allow executing current or previous steps
    if step_order > enrollment.current_step:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot execute steps ahead of current progress"
        )

    # Get script content
    script_type = execution_data.script_type
    if script_type == "setup":
        script = step.setup_script
    elif script_type == "validation":
        script = step.validation_script
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid script type. Use 'setup' or 'validation'"
        )

    # Create execution record
    execution = models.Execution(
        enrollment_id=enrollment.id,
        step_id=step.id,
        script_type=script_type,
        status="running"
    )
    db.add(execution)
    db.commit()
    db.refresh(execution)

    # Run the script with track's environment secrets
    result = runner.run_script(
        script=script or "",
        environment=track.env_secrets or {},
        docker_image=track.docker_image
    )

    # Update execution record
    execution.status = "success" if result["success"] else "failed"
    execution.stdout = result["stdout"]
    execution.stderr = result["stderr"]
    execution.exit_code = result["exit_code"]
    execution.duration_ms = result["duration_ms"]

    advanced = False

    # If validation succeeded, advance to next step
    if script_type == "validation" and result["success"]:
        total_steps = db.query(models.Step).filter(
            models.Step.track_id == track.id
        ).count()

        if step_order == enrollment.current_step:
            if enrollment.current_step < total_steps:
                enrollment.current_step += 1
                advanced = True
            elif enrollment.current_step == total_steps:
                enrollment.completed_at = datetime.utcnow()
                advanced = True

    db.commit()

    return schemas.ExecutionResult(
        success=result["success"],
        stdout=result["stdout"],
        stderr=result["stderr"],
        exit_code=result["exit_code"],
        duration_ms=result["duration_ms"],
        advanced=advanced
    )


@router.get("/history", response_model=list[schemas.Execution])
def get_execution_history(
    enrollment_id: int,
    step_order: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Get execution history for a specific step"""
    enrollment = db.query(models.Enrollment).filter(
        models.Enrollment.id == enrollment_id,
        models.Enrollment.user_id == current_user.id
    ).first()

    if not enrollment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Enrollment not found"
        )

    track = db.query(models.Track).filter(
        models.Track.id == enrollment.track_id
    ).first()

    step = db.query(models.Step).filter(
        models.Step.track_id == track.id,
        models.Step.order == step_order
    ).first()

    if not step:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Step not found"
        )

    return db.query(models.Execution).filter(
        models.Execution.enrollment_id == enrollment.id,
        models.Execution.step_id == step.id
    ).order_by(models.Execution.started_at.desc()).all()
