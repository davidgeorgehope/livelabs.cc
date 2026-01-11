from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/tracks", tags=["tracks"])


@router.get("", response_model=list[schemas.Track])
def list_tracks(db: Session = Depends(get_db)):
    """List all published tracks"""
    return db.query(models.Track).filter(
        models.Track.is_published == True
    ).order_by(models.Track.created_at.desc()).all()


@router.get("/public", response_model=schemas.PaginatedResponse[schemas.Track])
def list_public_tracks(
    db: Session = Depends(get_db),
    q: Optional[str] = Query(None, description="Search query for title/description"),
    tag: Optional[str] = Query(None, description="Filter by tag"),
    difficulty: Optional[str] = Query(None, description="Filter by difficulty"),
    sort: Optional[str] = Query("newest", description="Sort by: newest, oldest, title"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page")
):
    """List all published tracks with optional search, filters, and pagination"""
    query = db.query(models.Track).filter(models.Track.is_published == True)

    # Text search on title and description
    if q:
        search_term = f"%{q}%"
        query = query.filter(
            or_(
                models.Track.title.ilike(search_term),
                models.Track.description.ilike(search_term)
            )
        )

    # Filter by tag (JSON array contains)
    if tag:
        # SQLite JSON contains check
        query = query.filter(models.Track.tags.contains(f'"{tag}"'))

    # Filter by difficulty
    if difficulty and difficulty in ["beginner", "intermediate", "advanced"]:
        query = query.filter(models.Track.difficulty == difficulty)

    # Get total count before pagination
    total = query.count()

    # Sorting
    if sort == "oldest":
        query = query.order_by(models.Track.created_at.asc())
    elif sort == "title":
        query = query.order_by(models.Track.title.asc())
    else:  # newest (default)
        query = query.order_by(models.Track.created_at.desc())

    # Apply pagination
    offset = (page - 1) * page_size
    items = query.offset(offset).limit(page_size).all()
    pages = (total + page_size - 1) // page_size  # Ceiling division

    return schemas.PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages
    )


@router.get("/tags", response_model=list[str])
def list_all_tags(db: Session = Depends(get_db)):
    """Get all unique tags from published tracks"""
    tracks = db.query(models.Track).filter(
        models.Track.is_published == True
    ).all()

    # Collect unique tags from all tracks
    all_tags = set()
    for track in tracks:
        if track.tags:
            all_tags.update(track.tags)

    return sorted(list(all_tags))


@router.get("/my", response_model=list[schemas.TrackWithSecrets])
def list_my_tracks(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """List tracks authored by current user (includes secrets)"""
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
        env_secrets=track_data.env_secrets,
        tags=track_data.tags,
        difficulty=track_data.difficulty,
        estimated_minutes=track_data.estimated_minutes,
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


@router.get("/{slug}/edit", response_model=schemas.TrackWithStepsAndSecrets)
def get_track_for_editing(
    slug: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_author)
):
    """Get track with secrets for author editing"""
    track = db.query(models.Track).options(
        joinedload(models.Track.steps),
        joinedload(models.Track.author)
    ).filter(
        models.Track.slug == slug,
        models.Track.author_id == current_user.id
    ).first()

    if not track:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Track not found or not authorized"
        )

    return track


@router.patch("/{slug}", response_model=schemas.TrackWithSecrets)
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
