import hashlib
from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/achievements", tags=["achievements"])

# Define available achievements
ACHIEVEMENTS = [
    {
        "slug": "first_track",
        "name": "First Steps",
        "description": "Complete your first track",
        "icon": "rocket",
        "color": "blue",
        "xp_value": 100,
        "criteria_type": "tracks_completed",
        "criteria_value": 1,
    },
    {
        "slug": "track_master_5",
        "name": "Track Master",
        "description": "Complete 5 tracks",
        "icon": "trophy",
        "color": "gold",
        "xp_value": 500,
        "criteria_type": "tracks_completed",
        "criteria_value": 5,
    },
    {
        "slug": "track_master_10",
        "name": "Track Legend",
        "description": "Complete 10 tracks",
        "icon": "crown",
        "color": "purple",
        "xp_value": 1000,
        "criteria_type": "tracks_completed",
        "criteria_value": 10,
    },
    {
        "slug": "early_adopter",
        "name": "Early Adopter",
        "description": "Be among the first users to join",
        "icon": "star",
        "color": "yellow",
        "xp_value": 250,
        "criteria_type": "early_adopter",
        "criteria_value": 1,
    },
]


def seed_achievements(db: Session):
    """Seed achievements if they don't exist"""
    for achievement_data in ACHIEVEMENTS:
        existing = db.query(models.Achievement).filter(
            models.Achievement.slug == achievement_data["slug"]
        ).first()
        if not existing:
            achievement = models.Achievement(**achievement_data)
            db.add(achievement)
    db.commit()


def check_and_award_achievements(user_id: int, db: Session) -> List[models.UserAchievement]:
    """Check if user qualifies for any new achievements"""
    # Seed achievements first
    seed_achievements(db)

    new_achievements = []

    # Get user's current achievements
    existing_achievement_ids = set(
        ua.achievement_id for ua in db.query(models.UserAchievement).filter(
            models.UserAchievement.user_id == user_id
        ).all()
    )

    # Count completed tracks
    completed_tracks = db.query(models.Enrollment).filter(
        models.Enrollment.user_id == user_id,
        models.Enrollment.completed_at.isnot(None)
    ).count()

    # Check each achievement
    for achievement in db.query(models.Achievement).all():
        if achievement.id in existing_achievement_ids:
            continue

        qualified = False

        if achievement.criteria_type == "tracks_completed":
            qualified = completed_tracks >= achievement.criteria_value

        if qualified:
            user_achievement = models.UserAchievement(
                user_id=user_id,
                achievement_id=achievement.id
            )
            db.add(user_achievement)
            new_achievements.append(user_achievement)

    if new_achievements:
        db.commit()
        for ua in new_achievements:
            db.refresh(ua)

    return new_achievements


@router.get("/my", response_model=schemas.UserStats)
def get_my_stats(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's achievements and stats"""
    # Seed achievements
    seed_achievements(db)

    # Check for new achievements
    check_and_award_achievements(current_user.id, db)

    # Get achievements
    user_achievements = db.query(models.UserAchievement).filter(
        models.UserAchievement.user_id == current_user.id
    ).all()

    # Calculate stats
    completed_tracks = db.query(models.Enrollment).filter(
        models.Enrollment.user_id == current_user.id,
        models.Enrollment.completed_at.isnot(None)
    ).count()

    total_xp = sum(ua.achievement.xp_value for ua in user_achievements)

    return schemas.UserStats(
        total_xp=total_xp,
        tracks_completed=completed_tracks,
        achievements_count=len(user_achievements),
        achievements=[
            schemas.UserAchievement(
                id=ua.id,
                achievement=schemas.Achievement(
                    id=ua.achievement.id,
                    slug=ua.achievement.slug,
                    name=ua.achievement.name,
                    description=ua.achievement.description,
                    icon=ua.achievement.icon,
                    color=ua.achievement.color,
                    xp_value=ua.achievement.xp_value,
                ),
                earned_at=ua.earned_at,
            )
            for ua in user_achievements
        ],
    )


@router.get("/all", response_model=List[schemas.Achievement])
def list_all_achievements(db: Session = Depends(get_db)):
    """List all available achievements"""
    seed_achievements(db)
    achievements = db.query(models.Achievement).all()
    return achievements


@router.get("/certificate/{enrollment_id}", response_model=schemas.CertificateData)
def get_certificate(
    enrollment_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Get certificate data for a completed track"""
    enrollment = db.query(models.Enrollment).filter(
        models.Enrollment.id == enrollment_id,
        models.Enrollment.user_id == current_user.id
    ).first()

    if not enrollment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Enrollment not found"
        )

    if not enrollment.completed_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Track not yet completed"
        )

    # Generate certificate ID
    cert_data = f"{current_user.id}-{enrollment.track_id}-{enrollment.completed_at.isoformat()}"
    certificate_id = hashlib.sha256(cert_data.encode()).hexdigest()[:12].upper()

    return schemas.CertificateData(
        user_name=current_user.name,
        track_title=enrollment.track.title,
        completed_at=enrollment.completed_at.strftime("%B %d, %Y"),
        certificate_id=certificate_id,
    )
