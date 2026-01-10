import re
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/organizations", tags=["organizations"])


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
