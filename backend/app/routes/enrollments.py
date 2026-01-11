from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/enrollments", tags=["enrollments"])


@router.get("", response_model=schemas.PaginatedResponse[schemas.EnrollmentWithTrack])
def list_enrollments(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    status_filter: str = Query(None, description="Filter by status: active, completed")
):
    """List current user's enrollments with pagination"""
    query = db.query(models.Enrollment).options(
        joinedload(models.Enrollment.track)
    ).filter(
        models.Enrollment.user_id == current_user.id
    )

    # Filter by completion status
    if status_filter == "active":
        query = query.filter(models.Enrollment.completed_at.is_(None))
    elif status_filter == "completed":
        query = query.filter(models.Enrollment.completed_at.isnot(None))

    # Get total count
    total = query.count()

    # Order and paginate
    offset = (page - 1) * page_size
    items = query.order_by(models.Enrollment.started_at.desc()).offset(offset).limit(page_size).all()
    pages = (total + page_size - 1) // page_size if total > 0 else 1

    return schemas.PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages
    )


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

    # Environment comes from track.env_secrets now, not from learner
    enrollment = models.Enrollment(
        user_id=current_user.id,
        track_id=track.id,
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
