from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/tracks", tags=["tracks"])


@router.get("", response_model=list[schemas.Track])
def list_tracks(db: Session = Depends(get_db)):
    """List all published tracks"""
    return db.query(models.Track).filter(
        models.Track.is_published == True
    ).order_by(models.Track.created_at.desc()).all()


@router.get("/public", response_model=list[schemas.Track])
def list_public_tracks(db: Session = Depends(get_db)):
    """List all published tracks across all orgs (alias for list_tracks)"""
    return db.query(models.Track).filter(
        models.Track.is_published == True
    ).order_by(models.Track.created_at.desc()).all()


@router.get("/my", response_model=list[schemas.Track])
def list_my_tracks(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """List tracks authored by current user"""
    return db.query(models.Track).filter(
        models.Track.author_id == current_user.id
    ).order_by(models.Track.created_at.desc()).all()


@router.post("", response_model=schemas.Track, status_code=status.HTTP_201_CREATED)
def create_track(
    track_data: schemas.TrackCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_author)
):
    # Check slug uniqueness within org
    existing = db.query(models.Track).filter(
        models.Track.slug == track_data.slug,
        models.Track.org_id == current_user.org_id
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Track with this slug already exists"
        )

    track = models.Track(
        slug=track_data.slug,
        title=track_data.title,
        description=track_data.description,
        docker_image=track_data.docker_image,
        env_template=[e.model_dump() for e in track_data.env_template],
        author_id=current_user.id,
        org_id=current_user.org_id
    )
    db.add(track)
    db.commit()
    db.refresh(track)
    return track


@router.get("/{slug}", response_model=schemas.TrackWithSteps)
def get_track(
    slug: str,
    db: Session = Depends(get_db)
):
    track = db.query(models.Track).options(
        joinedload(models.Track.steps),
        joinedload(models.Track.author)
    ).filter(models.Track.slug == slug).first()

    if not track:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Track not found"
        )

    return track


@router.patch("/{slug}", response_model=schemas.Track)
def update_track(
    slug: str,
    track_data: schemas.TrackUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_author)
):
    track = db.query(models.Track).filter(
        models.Track.slug == slug,
        models.Track.org_id == current_user.org_id
    ).first()

    if not track:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Track not found"
        )

    # Only author or same org can update
    if track.author_id != current_user.id and track.org_id != current_user.org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this track"
        )

    update_data = track_data.model_dump(exclude_unset=True)
    if "env_template" in update_data and update_data["env_template"]:
        update_data["env_template"] = [e.model_dump() if hasattr(e, 'model_dump') else e for e in update_data["env_template"]]

    for field, value in update_data.items():
        setattr(track, field, value)

    db.commit()
    db.refresh(track)
    return track


@router.delete("/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def delete_track(
    slug: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_author)
):
    track = db.query(models.Track).filter(
        models.Track.slug == slug,
        models.Track.org_id == current_user.org_id
    ).first()

    if not track:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Track not found"
        )

    if track.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this track"
        )

    db.delete(track)
    db.commit()
