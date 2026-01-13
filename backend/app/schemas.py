import re
from datetime import datetime
from typing import Optional, Generic, TypeVar
from pydantic import BaseModel, EmailStr, field_validator

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated response wrapper"""
    items: list[T]
    total: int
    page: int
    page_size: int
    pages: int


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
    invite_code: Optional[str] = None  # Use invite code to join org

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
    tags: list[str] = []
    difficulty: str = "beginner"  # beginner, intermediate, advanced
    estimated_minutes: Optional[int] = None
    # App configuration
    app_url_template: Optional[str] = None
    app_container_image: Optional[str] = None
    app_container_ports: list[dict] = []
    app_container_command: Optional[str] = None
    app_container_lifecycle: str = "enrollment"
    app_container_env: dict = {}
    auto_run_setup: bool = True
    auto_login_type: str = "none"
    auto_login_config: dict = {}
    init_script: Optional[str] = None


class TrackCreate(TrackBase):
    env_secrets: dict[str, str] = {}  # Author-configured environment secrets


class TrackUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    docker_image: Optional[str] = None
    is_published: Optional[bool] = None
    env_template: Optional[list[EnvVar]] = None
    env_secrets: Optional[dict[str, str]] = None  # Author-configured environment secrets
    tags: Optional[list[str]] = None
    difficulty: Optional[str] = None
    estimated_minutes: Optional[int] = None
    # App configuration
    app_url_template: Optional[str] = None
    app_container_image: Optional[str] = None
    app_container_ports: Optional[list[dict]] = None  # [{container: int, host: int|null}]
    app_container_command: Optional[str] = None
    app_container_lifecycle: Optional[str] = None  # "enrollment" | "step"
    app_container_env: Optional[dict[str, str]] = None
    auto_run_setup: Optional[bool] = None
    auto_login_type: Optional[str] = None  # "none" | "url_params" | "cookies"
    auto_login_config: Optional[dict] = None  # {params: {}, cookies: []}
    init_script: Optional[str] = None  # Runs once when lab starts, outputs JSON


class Track(TrackBase):
    id: int
    is_published: bool
    author_id: int
    org_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class TrackWithSecrets(Track):
    """Track schema for authors that includes env_secrets"""
    env_secrets: dict[str, str] = {}


class TrackWithSteps(Track):
    steps: list["Step"] = []
    author: User


class TrackWithStepsAndSecrets(TrackWithSecrets):
    """Track with steps and secrets - for author editing"""
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
    # Note: environment is no longer needed - track secrets are used instead


class Enrollment(BaseModel):
    id: int
    user_id: int
    track_id: int
    current_step: int
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


# Invite code schemas
class InviteCodeCreate(BaseModel):
    max_uses: Optional[int] = None  # None = unlimited
    expires_in_days: Optional[int] = None  # None = never expires


class InviteCode(BaseModel):
    id: int
    code: str
    org_id: int
    max_uses: Optional[int]
    uses: int
    is_active: bool
    expires_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class InviteCodeWithOrg(InviteCode):
    organization: Organization


class InviteCodeValidation(BaseModel):
    """Response when validating an invite code"""
    valid: bool
    organization: Optional[OrganizationPublic] = None
    message: str


# Achievement schemas
class Achievement(BaseModel):
    id: int
    slug: str
    name: str
    description: Optional[str]
    icon: str
    color: str
    xp_value: int

    class Config:
        from_attributes = True


class UserAchievement(BaseModel):
    id: int
    achievement: Achievement
    earned_at: datetime

    class Config:
        from_attributes = True


class UserStats(BaseModel):
    total_xp: int
    tracks_completed: int
    achievements_count: int
    achievements: list[UserAchievement]


class CertificateData(BaseModel):
    user_name: str
    track_title: str
    completed_at: str
    certificate_id: str


# Update forward refs
TrackWithSteps.model_rebuild()
TrackWithStepsAndSecrets.model_rebuild()
