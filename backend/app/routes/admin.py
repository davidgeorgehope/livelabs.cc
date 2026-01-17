"""Admin dashboard endpoints"""
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from .. import models, auth
from ..database import get_db
from ..email import send_approval_email, send_rejection_email

router = APIRouter(prefix="/admin", tags=["admin"])


# Response schemas
class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    is_author: bool
    is_admin: bool
    is_active: bool
    status: str  # pending, approved, rejected
    org_id: int
    organization_name: Optional[str]
    created_at: datetime
    tracks_count: int
    enrollments_count: int

    class Config:
        from_attributes = True


class OrganizationResponse(BaseModel):
    id: int
    slug: str
    name: str
    created_at: datetime
    users_count: int
    tracks_count: int

    class Config:
        from_attributes = True


class SystemStats(BaseModel):
    total_users: int
    total_authors: int
    total_admins: int
    pending_users: int
    total_organizations: int
    total_tracks: int
    published_tracks: int
    total_enrollments: int
    completed_enrollments: int
    total_executions: int
    active_users_7d: int
    new_users_7d: int


class UserUpdate(BaseModel):
    is_author: Optional[bool] = None
    is_admin: Optional[bool] = None
    is_active: Optional[bool] = None


class RejectRequest(BaseModel):
    reason: Optional[str] = None


class OrganizationUpdate(BaseModel):
    name: Optional[str] = None


@router.get("/stats", response_model=SystemStats)
def get_system_stats(
    current_user: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Get system-wide statistics"""
    now = datetime.utcnow()
    seven_days_ago = now - timedelta(days=7)

    # User stats
    total_users = db.query(models.User).count()
    total_authors = db.query(models.User).filter(models.User.is_author == True).count()
    total_admins = db.query(models.User).filter(models.User.is_admin == True).count()
    pending_users = db.query(models.User).filter(models.User.status == "pending").count()

    # Organization stats
    total_organizations = db.query(models.Organization).count()

    # Track stats
    total_tracks = db.query(models.Track).count()
    published_tracks = db.query(models.Track).filter(models.Track.is_published == True).count()

    # Enrollment stats
    total_enrollments = db.query(models.Enrollment).count()
    completed_enrollments = db.query(models.Enrollment).filter(
        models.Enrollment.completed_at.isnot(None)
    ).count()

    # Execution stats
    total_executions = db.query(models.Execution).count()

    # Activity stats
    new_users_7d = db.query(models.User).filter(
        models.User.created_at >= seven_days_ago
    ).count()

    # Active users = users with enrollments or executions in last 7 days
    active_user_ids = set()

    recent_enrollments = db.query(models.Enrollment.user_id).filter(
        models.Enrollment.started_at >= seven_days_ago
    ).distinct().all()
    active_user_ids.update([e[0] for e in recent_enrollments])

    recent_executions = db.query(models.Enrollment.user_id).join(models.Execution).filter(
        models.Execution.started_at >= seven_days_ago
    ).distinct().all()
    active_user_ids.update([e[0] for e in recent_executions])

    return SystemStats(
        total_users=total_users,
        total_authors=total_authors,
        total_admins=total_admins,
        pending_users=pending_users,
        total_organizations=total_organizations,
        total_tracks=total_tracks,
        published_tracks=published_tracks,
        total_enrollments=total_enrollments,
        completed_enrollments=completed_enrollments,
        total_executions=total_executions,
        active_users_7d=len(active_user_ids),
        new_users_7d=new_users_7d
    )


@router.get("/users", response_model=list[UserResponse])
def list_users(
    search: Optional[str] = None,
    org_id: Optional[int] = None,
    is_author: Optional[bool] = None,
    is_admin: Optional[bool] = None,
    is_active: Optional[bool] = None,
    status: Optional[str] = None,
    limit: int = Query(default=50, le=100),
    offset: int = 0,
    current_user: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """List all users with filters"""
    query = db.query(models.User)

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (models.User.email.ilike(search_pattern)) |
            (models.User.name.ilike(search_pattern))
        )

    if org_id is not None:
        query = query.filter(models.User.org_id == org_id)

    if is_author is not None:
        query = query.filter(models.User.is_author == is_author)

    if is_admin is not None:
        query = query.filter(models.User.is_admin == is_admin)

    if is_active is not None:
        query = query.filter(models.User.is_active == is_active)

    if status is not None:
        query = query.filter(models.User.status == status)

    users = query.order_by(models.User.created_at.desc()).offset(offset).limit(limit).all()

    result = []
    for user in users:
        tracks_count = db.query(models.Track).filter(models.Track.author_id == user.id).count()
        enrollments_count = db.query(models.Enrollment).filter(models.Enrollment.user_id == user.id).count()

        result.append(UserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            is_author=user.is_author,
            is_admin=user.is_admin,
            is_active=getattr(user, 'is_active', True),
            status=getattr(user, 'status', 'approved'),
            org_id=user.org_id,
            organization_name=user.organization.name if user.organization else None,
            created_at=user.created_at,
            tracks_count=tracks_count,
            enrollments_count=enrollments_count
        ))

    return result


@router.get("/users/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    current_user: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Get user details"""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    tracks_count = db.query(models.Track).filter(models.Track.author_id == user.id).count()
    enrollments_count = db.query(models.Enrollment).filter(models.Enrollment.user_id == user.id).count()

    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        is_author=user.is_author,
        is_admin=user.is_admin,
        is_active=getattr(user, 'is_active', True),
        status=getattr(user, 'status', 'approved'),
        org_id=user.org_id,
        organization_name=user.organization.name if user.organization else None,
        created_at=user.created_at,
        tracks_count=tracks_count,
        enrollments_count=enrollments_count
    )


@router.patch("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    data: UserUpdate,
    current_user: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Update user roles/status"""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Prevent self-demotion from admin
    if user.id == current_user.id and data.is_admin is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove your own admin status"
        )

    if data.is_author is not None:
        user.is_author = data.is_author
    if data.is_admin is not None:
        user.is_admin = data.is_admin
    if data.is_active is not None:
        user.is_active = data.is_active

    db.commit()
    db.refresh(user)

    tracks_count = db.query(models.Track).filter(models.Track.author_id == user.id).count()
    enrollments_count = db.query(models.Enrollment).filter(models.Enrollment.user_id == user.id).count()

    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        is_author=user.is_author,
        is_admin=user.is_admin,
        is_active=getattr(user, 'is_active', True),
        status=getattr(user, 'status', 'approved'),
        org_id=user.org_id,
        organization_name=user.organization.name if user.organization else None,
        created_at=user.created_at,
        tracks_count=tracks_count,
        enrollments_count=enrollments_count
    )


@router.get("/pending-users", response_model=list[UserResponse])
def list_pending_users(
    current_user: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """List all users with status='pending'"""
    users = db.query(models.User).filter(
        models.User.status == "pending"
    ).order_by(models.User.created_at.desc()).all()

    result = []
    for user in users:
        tracks_count = db.query(models.Track).filter(models.Track.author_id == user.id).count()
        enrollments_count = db.query(models.Enrollment).filter(models.Enrollment.user_id == user.id).count()

        result.append(UserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            is_author=user.is_author,
            is_admin=user.is_admin,
            is_active=getattr(user, 'is_active', True),
            status=getattr(user, 'status', 'pending'),
            org_id=user.org_id,
            organization_name=user.organization.name if user.organization else None,
            created_at=user.created_at,
            tracks_count=tracks_count,
            enrollments_count=enrollments_count
        ))

    return result


@router.post("/users/{user_id}/approve", response_model=UserResponse)
def approve_user(
    user_id: int,
    current_user: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Approve a pending user - sets status='approved' and is_author=True"""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if getattr(user, 'status', 'approved') != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not pending approval"
        )

    user.status = "approved"
    user.is_author = True
    db.commit()
    db.refresh(user)

    # Send approval notification email
    send_approval_email(user.email, user.name)

    tracks_count = db.query(models.Track).filter(models.Track.author_id == user.id).count()
    enrollments_count = db.query(models.Enrollment).filter(models.Enrollment.user_id == user.id).count()

    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        is_author=user.is_author,
        is_admin=user.is_admin,
        is_active=getattr(user, 'is_active', True),
        status=user.status,
        org_id=user.org_id,
        organization_name=user.organization.name if user.organization else None,
        created_at=user.created_at,
        tracks_count=tracks_count,
        enrollments_count=enrollments_count
    )


@router.post("/users/{user_id}/reject", response_model=UserResponse)
def reject_user(
    user_id: int,
    data: RejectRequest,
    current_user: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Reject a pending user - sets status='rejected'"""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if getattr(user, 'status', 'approved') != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not pending approval"
        )

    user.status = "rejected"
    db.commit()
    db.refresh(user)

    # Send rejection notification email
    send_rejection_email(user.email, user.name, data.reason)

    tracks_count = db.query(models.Track).filter(models.Track.author_id == user.id).count()
    enrollments_count = db.query(models.Enrollment).filter(models.Enrollment.user_id == user.id).count()

    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        is_author=user.is_author,
        is_admin=user.is_admin,
        is_active=getattr(user, 'is_active', True),
        status=user.status,
        org_id=user.org_id,
        organization_name=user.organization.name if user.organization else None,
        created_at=user.created_at,
        tracks_count=tracks_count,
        enrollments_count=enrollments_count
    )


@router.get("/organizations", response_model=list[OrganizationResponse])
def list_organizations(
    search: Optional[str] = None,
    limit: int = Query(default=50, le=100),
    offset: int = 0,
    current_user: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """List all organizations"""
    query = db.query(models.Organization)

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (models.Organization.name.ilike(search_pattern)) |
            (models.Organization.slug.ilike(search_pattern))
        )

    orgs = query.order_by(models.Organization.created_at.desc()).offset(offset).limit(limit).all()

    result = []
    for org in orgs:
        users_count = db.query(models.User).filter(models.User.org_id == org.id).count()
        tracks_count = db.query(models.Track).filter(models.Track.org_id == org.id).count()

        result.append(OrganizationResponse(
            id=org.id,
            slug=org.slug,
            name=org.name,
            created_at=org.created_at,
            users_count=users_count,
            tracks_count=tracks_count
        ))

    return result


@router.get("/organizations/{org_id}", response_model=OrganizationResponse)
def get_organization(
    org_id: int,
    current_user: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Get organization details"""
    org = db.query(models.Organization).filter(models.Organization.id == org_id).first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )

    users_count = db.query(models.User).filter(models.User.org_id == org.id).count()
    tracks_count = db.query(models.Track).filter(models.Track.org_id == org.id).count()

    return OrganizationResponse(
        id=org.id,
        slug=org.slug,
        name=org.name,
        created_at=org.created_at,
        users_count=users_count,
        tracks_count=tracks_count
    )


@router.patch("/organizations/{org_id}", response_model=OrganizationResponse)
def update_organization(
    org_id: int,
    data: OrganizationUpdate,
    current_user: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Update organization"""
    org = db.query(models.Organization).filter(models.Organization.id == org_id).first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )

    if data.name is not None:
        org.name = data.name

    db.commit()
    db.refresh(org)

    users_count = db.query(models.User).filter(models.User.org_id == org.id).count()
    tracks_count = db.query(models.Track).filter(models.Track.org_id == org.id).count()

    return OrganizationResponse(
        id=org.id,
        slug=org.slug,
        name=org.name,
        created_at=org.created_at,
        users_count=users_count,
        tracks_count=tracks_count
    )
