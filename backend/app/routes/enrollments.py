from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/enrollments", tags=["enrollments"])


@router.get("", response_model=list[schemas.EnrollmentWithTrack])
def list_enrollments(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """List current user's enrollments"""
    return db.query(models.Enrollment).options(
        joinedload(models.Enrollment.track)
    ).filter(
        models.Enrollment.user_id == current_user.id
    ).order_by(models.Enrollment.started_at.desc()).all()


@router.post("", response_model=schemas.Enrollment, status_code=status.HTTP_201_CREATED)
def create_enrollment(
    enrollment_data: schemas.EnrollmentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Find track by slug
    track = db.query(models.Track).filter(
        models.Track.slug == enrollment_data.track_slug
    ).first()

    if not track:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Track not found"
        )

    # Check if track is published or user is in same org
    if not track.is_published and track.org_id != current_user.org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Track not available"
        )

    # Check for existing enrollment
    existing = db.query(models.Enrollment).filter(
        models.Enrollment.user_id == current_user.id,
        models.Enrollment.track_id == track.id
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Already enrolled in this track"
        )

    # Validate required env vars
    required_vars = [e["name"] for e in (track.env_template or []) if e.get("required", True)]
    missing_vars = [v for v in required_vars if v not in enrollment_data.environment]
    if missing_vars:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing required environment variables: {', '.join(missing_vars)}"
        )

    enrollment = models.Enrollment(
        user_id=current_user.id,
        track_id=track.id,
        environment=enrollment_data.environment,
        current_step=1
    )
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)
    return enrollment


@router.get("/{enrollment_id}", response_model=schemas.EnrollmentDetail)
def get_enrollment(
    enrollment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    enrollment = db.query(models.Enrollment).options(
        joinedload(models.Enrollment.track).joinedload(models.Track.steps),
        joinedload(models.Enrollment.track).joinedload(models.Track.author)
    ).filter(
        models.Enrollment.id == enrollment_id,
        models.Enrollment.user_id == current_user.id
    ).first()

    if not enrollment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Enrollment not found"
        )

    return enrollment


@router.patch("/{enrollment_id}/environment", response_model=schemas.Enrollment)
def update_enrollment_env(
    enrollment_id: int,
    environment: dict[str, str],
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Update enrollment environment variables"""
    enrollment = db.query(models.Enrollment).filter(
        models.Enrollment.id == enrollment_id,
        models.Enrollment.user_id == current_user.id
    ).first()

    if not enrollment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Enrollment not found"
        )

    # Merge with existing environment
    current_env = enrollment.environment or {}
    current_env.update(environment)
    enrollment.environment = current_env

    db.commit()
    db.refresh(enrollment)
    return enrollment


@router.delete("/{enrollment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_enrollment(
    enrollment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Unenroll from a track"""
    enrollment = db.query(models.Enrollment).filter(
        models.Enrollment.id == enrollment_id,
        models.Enrollment.user_id == current_user.id
    ).first()

    if not enrollment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Enrollment not found"
        )

    db.delete(enrollment)
    db.commit()
