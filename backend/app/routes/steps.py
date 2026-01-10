from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/tracks/{slug}/steps", tags=["steps"])


def get_track_or_404(slug: str, db: Session, org_id: int) -> models.Track:
    track = db.query(models.Track).filter(
        models.Track.slug == slug,
        models.Track.org_id == org_id
    ).first()
    if not track:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Track not found"
        )
    return track


@router.post("", response_model=schemas.Step, status_code=status.HTTP_201_CREATED)
def create_step(
    slug: str,
    step_data: schemas.StepCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_author)
):
    track = get_track_or_404(slug, db, current_user.org_id)

    # Get next order number
    max_order = db.query(models.Step).filter(
        models.Step.track_id == track.id
    ).count()

    step = models.Step(
        track_id=track.id,
        order=max_order + 1,
        title=step_data.title,
        instructions_md=step_data.instructions_md,
        setup_script=step_data.setup_script,
        validation_script=step_data.validation_script,
        hints=step_data.hints
    )
    db.add(step)
    db.commit()
    db.refresh(step)
    return step


@router.get("/{step_id}", response_model=schemas.Step)
def get_step(
    slug: str,
    step_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    track = get_track_or_404(slug, db, current_user.org_id)

    step = db.query(models.Step).filter(
        models.Step.id == step_id,
        models.Step.track_id == track.id
    ).first()

    if not step:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Step not found"
        )

    return step


@router.patch("/{step_id}", response_model=schemas.Step)
def update_step(
    slug: str,
    step_id: int,
    step_data: schemas.StepUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_author)
):
    track = get_track_or_404(slug, db, current_user.org_id)

    step = db.query(models.Step).filter(
        models.Step.id == step_id,
        models.Step.track_id == track.id
    ).first()

    if not step:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Step not found"
        )

    update_data = step_data.model_dump(exclude_unset=True)

    # Handle reordering
    if "order" in update_data:
        new_order = update_data["order"]
        old_order = step.order

        if new_order != old_order:
            # Shift other steps
            if new_order > old_order:
                # Moving down: shift steps between old and new position up
                db.query(models.Step).filter(
                    models.Step.track_id == track.id,
                    models.Step.order > old_order,
                    models.Step.order <= new_order
                ).update({models.Step.order: models.Step.order - 1})
            else:
                # Moving up: shift steps between new and old position down
                db.query(models.Step).filter(
                    models.Step.track_id == track.id,
                    models.Step.order >= new_order,
                    models.Step.order < old_order
                ).update({models.Step.order: models.Step.order + 1})

    for field, value in update_data.items():
        setattr(step, field, value)

    db.commit()
    db.refresh(step)
    return step


@router.delete("/{step_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_step(
    slug: str,
    step_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_author)
):
    track = get_track_or_404(slug, db, current_user.org_id)

    step = db.query(models.Step).filter(
        models.Step.id == step_id,
        models.Step.track_id == track.id
    ).first()

    if not step:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Step not found"
        )

    deleted_order = step.order

    db.delete(step)

    # Reorder remaining steps
    db.query(models.Step).filter(
        models.Step.track_id == track.id,
        models.Step.order > deleted_order
    ).update({models.Step.order: models.Step.order - 1})

    db.commit()
