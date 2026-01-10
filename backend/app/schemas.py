import re
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator


# Organization schemas
class OrganizationBase(BaseModel):
    name: str
    slug: str


class OrganizationCreate(OrganizationBase):
    pass


class OrganizationCreateRequest(BaseModel):
    """Request schema for creating an organization - slug is optional"""
    name: str
    slug: Optional[str] = None  # Auto-generated from name if not provided


class OrganizationPublic(BaseModel):
    """Public organization info - for listing available orgs"""
    id: int
    slug: str
    name: str

    class Config:
        from_attributes = True


class Organization(OrganizationBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# User schemas
class UserBase(BaseModel):
    email: EmailStr
    name: str


class UserCreate(UserBase):
    password: str
    org_slug: Optional[str] = None  # Join existing org or create new

    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class User(UserBase):
    id: int
    is_author: bool
    org_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class UserWithOrg(User):
    organization: Organization


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[int] = None


# Track schemas
class EnvVar(BaseModel):
    name: str
    description: str = ""
    required: bool = True


class TrackBase(BaseModel):
    title: str
    slug: str
    description: Optional[str] = ""
    docker_image: Optional[str] = "livelabs-runner:latest"
    env_template: list[EnvVar] = []


class TrackCreate(TrackBase):
    pass


class TrackUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    docker_image: Optional[str] = None
    is_published: Optional[bool] = None
    env_template: Optional[list[EnvVar]] = None


class Track(TrackBase):
    id: int
    is_published: bool
    author_id: int
    org_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class TrackWithSteps(Track):
    steps: list["Step"] = []
    author: User


# Step schemas
class StepBase(BaseModel):
    title: str
    instructions_md: Optional[str] = ""
    setup_script: Optional[str] = ""
    validation_script: Optional[str] = ""
    hints: list[str] = []


class StepCreate(StepBase):
    pass


class StepUpdate(BaseModel):
    title: Optional[str] = None
    instructions_md: Optional[str] = None
    setup_script: Optional[str] = None
    validation_script: Optional[str] = None
    hints: Optional[list[str]] = None
    order: Optional[int] = None


class Step(StepBase):
    id: int
    track_id: int
    order: int

    class Config:
        from_attributes = True


# Enrollment schemas
class EnrollmentCreate(BaseModel):
    track_slug: str
    environment: dict[str, str] = {}


class Enrollment(BaseModel):
    id: int
    user_id: int
    track_id: int
    current_step: int
    environment: dict[str, str]
    started_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class EnrollmentWithTrack(Enrollment):
    track: Track


class EnrollmentDetail(Enrollment):
    track: TrackWithSteps


# Execution schemas
class ExecutionCreate(BaseModel):
    script_type: str  # "setup" or "validation"


class Execution(BaseModel):
    id: int
    enrollment_id: int
    step_id: int
    script_type: str
    status: str
    stdout: str
    stderr: str
    exit_code: Optional[int]
    duration_ms: Optional[int]
    started_at: datetime

    class Config:
        from_attributes = True


class ExecutionResult(BaseModel):
    success: bool
    stdout: str
    stderr: str
    exit_code: int
    duration_ms: int
    advanced: bool = False  # Did validation pass and advance the step?


# Update forward refs
TrackWithSteps.model_rebuild()
