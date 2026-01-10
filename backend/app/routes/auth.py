from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=schemas.Token)
def register(user_data: schemas.UserCreate, db: Session = Depends(get_db)):
    # Check if email exists
    existing = db.query(models.User).filter(models.User.email == user_data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Find or create organization
    if user_data.org_slug:
        org = db.query(models.Organization).filter(
            models.Organization.slug == user_data.org_slug
        ).first()
        if not org:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Organization not found"
            )
    else:
        # Create new org based on user's name
        org_slug = user_data.email.split("@")[0].lower().replace(".", "-")
        org = db.query(models.Organization).filter(
            models.Organization.slug == org_slug
        ).first()
        if not org:
            org = models.Organization(
                slug=org_slug,
                name=f"{user_data.name}'s Organization"
            )
            db.add(org)
            db.flush()

    # Create user
    user = models.User(
        email=user_data.email,
        hashed_password=auth.get_password_hash(user_data.password),
        name=user_data.name,
        is_author=True,  # All users can author by default
        org_id=org.id
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Generate token
    access_token = auth.create_access_token(data={"sub": user.id})
    return schemas.Token(access_token=access_token)


@router.post("/login", response_model=schemas.Token)
def login(user_data: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == user_data.email).first()
    if not user or not auth.verify_password(user_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    access_token = auth.create_access_token(data={"sub": user.id})
    return schemas.Token(access_token=access_token)


@router.get("/me", response_model=schemas.UserWithOrg)
def get_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user
