from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address
from .. import models, schemas, auth
from ..database import get_db
from ..email import send_signup_notification

router = APIRouter(prefix="/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)


class RegisterResponse(BaseModel):
    message: str
    status: str  # "pending" or "approved"


@router.post("/register", response_model=RegisterResponse)
@limiter.limit("5/minute")
def register(request: Request, user_data: schemas.UserCreate, db: Session = Depends(get_db)):
    from datetime import datetime

    # Check if email exists
    existing = db.query(models.User).filter(models.User.email == user_data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    invite = None
    org = None

    # Priority: invite_code > org_slug > create new org
    if user_data.invite_code:
        # Validate and use invite code
        invite = db.query(models.InviteCode).filter(
            models.InviteCode.code == user_data.invite_code.upper()
        ).first()

        if not invite:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid invite code"
            )

        if not invite.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This invite code has been deactivated"
            )

        if invite.expires_at and invite.expires_at < datetime.utcnow():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This invite code has expired"
            )

        if invite.max_uses and invite.uses >= invite.max_uses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This invite code has reached its maximum uses"
            )

        org = invite.organization

    elif user_data.org_slug:
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

    # Create user with pending status (requires admin approval)
    user = models.User(
        email=user_data.email,
        hashed_password=auth.get_password_hash(user_data.password),
        name=user_data.name,
        is_author=False,  # Set to True upon approval
        status="pending",
        org_id=org.id
    )
    db.add(user)

    # Increment invite code usage if used
    if invite:
        invite.uses += 1

    db.commit()
    db.refresh(user)

    # Send notification to admin (async via threading)
    send_signup_notification(user.email, user.name)

    return RegisterResponse(
        message="Account created. Awaiting admin approval.",
        status="pending"
    )


@router.post("/login", response_model=schemas.Token)
@limiter.limit("5/minute")
def login(request: Request, user_data: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == user_data.email).first()
    if not user or not auth.verify_password(user_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # Check user approval status - block pending and rejected users
    user_status = getattr(user, 'status', 'approved')  # Default to approved for existing users
    if user_status == "pending":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is pending approval. Please wait for an admin to review your registration."
        )
    if user_status == "rejected":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account registration was not approved. Please contact support if you have questions."
        )

    # Also check is_active for suspended users
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Please contact support."
        )

    access_token = auth.create_access_token(data={"sub": user.id})
    return schemas.Token(access_token=access_token)


@router.get("/me", response_model=schemas.UserWithOrg)
def get_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user


@router.post("/refresh", response_model=schemas.Token)
def refresh_token(current_user: models.User = Depends(auth.get_current_user)):
    """Refresh an access token using a valid token"""
    access_token = auth.create_access_token(data={"sub": current_user.id})
    return schemas.Token(access_token=access_token)
