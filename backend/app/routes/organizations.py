import re
import secrets
from datetime import datetime, timedelta
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/organizations", tags=["organizations"])


def generate_invite_code() -> str:
    """Generate a unique 6-character alphanumeric invite code"""
    return secrets.token_urlsafe(4)[:6].upper()


def slugify(name: str) -> str:
    """Convert a name to a URL-friendly slug"""
    # Convert to lowercase
    slug = name.lower()
    # Replace spaces and special chars with hyphens
    slug = re.sub(r'[^a-z0-9]+', '-', slug)
    # Remove leading/trailing hyphens
    slug = slug.strip('-')
    # Collapse multiple hyphens
    slug = re.sub(r'-+', '-', slug)
    return slug


@router.get("/public", response_model=List[schemas.OrganizationPublic])
def list_public_organizations(db: Session = Depends(get_db)):
    """List all organizations (for joining during signup)"""
    orgs = db.query(models.Organization).all()
    return orgs


@router.get("/my", response_model=schemas.Organization)
def get_my_organization(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's organization"""
    return current_user.organization


@router.post("/", response_model=schemas.Organization, status_code=status.HTTP_201_CREATED)
def create_organization(
    data: schemas.OrganizationCreateRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new organization"""
    # Generate slug from name if not provided
    slug = data.slug if data.slug else slugify(data.name)

    # Check if slug already exists
    existing = db.query(models.Organization).filter(
        models.Organization.slug == slug
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Organization with slug '{slug}' already exists"
        )

    # Create the organization
    org = models.Organization(
        name=data.name,
        slug=slug
    )
    db.add(org)
    db.commit()
    db.refresh(org)

    return org


@router.post("/{org_slug}/join", response_model=schemas.UserWithOrg)
def join_organization(
    org_slug: str,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Join an existing organization"""
    # Find the organization
    org = db.query(models.Organization).filter(
        models.Organization.slug == org_slug
    ).first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )

    # Update user's organization
    current_user.org_id = org.id
    db.commit()
    db.refresh(current_user)

    return current_user


@router.get("/{org_slug}", response_model=schemas.Organization)
def get_organization(
    org_slug: str,
    db: Session = Depends(get_db)
):
    """Get organization by slug"""
    org = db.query(models.Organization).filter(
        models.Organization.slug == org_slug
    ).first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )
    return org


# Invite code endpoints
@router.post("/my/invite-codes", response_model=schemas.InviteCode, status_code=status.HTTP_201_CREATED)
def create_invite_code(
    data: schemas.InviteCodeCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Create an invite code for the current user's organization"""
    # Generate unique code
    code = generate_invite_code()
    while db.query(models.InviteCode).filter(models.InviteCode.code == code).first():
        code = generate_invite_code()

    # Calculate expiration
    expires_at = None
    if data.expires_in_days:
        expires_at = datetime.utcnow() + timedelta(days=data.expires_in_days)

    invite = models.InviteCode(
        code=code,
        org_id=current_user.org_id,
        created_by_id=current_user.id,
        max_uses=data.max_uses,
        expires_at=expires_at
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)

    return invite


@router.get("/my/invite-codes", response_model=List[schemas.InviteCode])
def list_my_invite_codes(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """List all invite codes for the current user's organization"""
    codes = db.query(models.InviteCode).filter(
        models.InviteCode.org_id == current_user.org_id
    ).order_by(models.InviteCode.created_at.desc()).all()
    return codes


@router.delete("/my/invite-codes/{code}")
def delete_invite_code(
    code: str,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Delete (deactivate) an invite code"""
    invite = db.query(models.InviteCode).filter(
        models.InviteCode.code == code,
        models.InviteCode.org_id == current_user.org_id
    ).first()
    if not invite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invite code not found"
        )

    invite.is_active = False
    db.commit()

    return {"message": "Invite code deactivated"}


@router.get("/invite/{code}", response_model=schemas.InviteCodeValidation)
def validate_invite_code(
    code: str,
    db: Session = Depends(get_db)
):
    """Validate an invite code (public endpoint for registration)"""
    invite = db.query(models.InviteCode).filter(
        models.InviteCode.code == code.upper()
    ).first()

    if not invite:
        return schemas.InviteCodeValidation(
            valid=False,
            message="Invalid invite code"
        )

    if not invite.is_active:
        return schemas.InviteCodeValidation(
            valid=False,
            message="This invite code has been deactivated"
        )

    if invite.expires_at and invite.expires_at < datetime.utcnow():
        return schemas.InviteCodeValidation(
            valid=False,
            message="This invite code has expired"
        )

    if invite.max_uses and invite.uses >= invite.max_uses:
        return schemas.InviteCodeValidation(
            valid=False,
            message="This invite code has reached its maximum uses"
        )

    return schemas.InviteCodeValidation(
        valid=True,
        organization=invite.organization,
        message="Valid invite code"
    )
