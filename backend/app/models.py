from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from .database import Base


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(100), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    users = relationship("User", back_populates="organization")
    tracks = relationship("Track", back_populates="organization")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    is_author = Column(Boolean, default=False)
    is_admin = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    organization = relationship("Organization", back_populates="users")
    tracks = relationship("Track", back_populates="author")
    enrollments = relationship("Enrollment", back_populates="user")


class Track(Base):
    __tablename__ = "tracks"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(100), index=True, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    docker_image = Column(String(255), default="livelabs-runner:latest")
    is_published = Column(Boolean, default=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    env_template = Column(JSON, default=list)  # List of {name, description, required} - documentation for authors
    env_secrets = Column(JSON, default=dict)  # Dict of {name: value} - author-configured secrets, injected at runtime
    tags = Column(JSON, default=list)  # List of tag strings (e.g., ["kubernetes", "python"])
    difficulty = Column(String(20), default="beginner")  # beginner, intermediate, advanced
    estimated_minutes = Column(Integer, nullable=True)  # Estimated completion time
    created_at = Column(DateTime, default=datetime.utcnow)

    author = relationship("User", back_populates="tracks")
    organization = relationship("Organization", back_populates="tracks")
    steps = relationship("Step", back_populates="track", order_by="Step.order", cascade="all, delete-orphan")
    enrollments = relationship("Enrollment", back_populates="track", cascade="all, delete-orphan")


class Step(Base):
    __tablename__ = "steps"

    id = Column(Integer, primary_key=True, index=True)
    track_id = Column(Integer, ForeignKey("tracks.id"), nullable=False)
    order = Column(Integer, nullable=False)
    title = Column(String(255), nullable=False)
    instructions_md = Column(Text, default="")
    setup_script = Column(Text, default="")
    validation_script = Column(Text, default="")
    hints = Column(JSON, default=list)  # List of hint strings

    track = relationship("Track", back_populates="steps")
    executions = relationship("Execution", back_populates="step", cascade="all, delete-orphan")


class Enrollment(Base):
    __tablename__ = "enrollments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    track_id = Column(Integer, ForeignKey("tracks.id"), nullable=False)
    current_step = Column(Integer, default=1)  # 1-indexed step order
    environment = Column(JSON, default=dict)  # User's env vars (API keys, etc.)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="enrollments")
    track = relationship("Track", back_populates="enrollments")
    executions = relationship("Execution", back_populates="enrollment", cascade="all, delete-orphan")


class Execution(Base):
    __tablename__ = "executions"

    id = Column(Integer, primary_key=True, index=True)
    enrollment_id = Column(Integer, ForeignKey("enrollments.id"), nullable=False)
    step_id = Column(Integer, ForeignKey("steps.id"), nullable=False)
    script_type = Column(String(20), nullable=False)  # "setup" or "validation"
    status = Column(String(20), default="pending")  # pending, running, success, failed
    stdout = Column(Text, default="")
    stderr = Column(Text, default="")
    exit_code = Column(Integer, nullable=True)
    duration_ms = Column(Integer, nullable=True)
    started_at = Column(DateTime, default=datetime.utcnow)

    enrollment = relationship("Enrollment", back_populates="executions")
    step = relationship("Step", back_populates="executions")


class InviteCode(Base):
    __tablename__ = "invite_codes"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(8), unique=True, index=True, nullable=False)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    max_uses = Column(Integer, nullable=True)  # None = unlimited
    uses = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    organization = relationship("Organization", backref="invite_codes")
    created_by = relationship("User", backref="created_invite_codes")


class Achievement(Base):
    __tablename__ = "achievements"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    icon = Column(String(50), default="trophy")  # Icon name
    color = Column(String(20), default="gold")  # Badge color
    xp_value = Column(Integer, default=100)
    criteria_type = Column(String(50), nullable=False)  # tracks_completed, first_track, etc.
    criteria_value = Column(Integer, default=1)  # Number needed to unlock


class UserAchievement(Base):
    __tablename__ = "user_achievements"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    achievement_id = Column(Integer, ForeignKey("achievements.id"), nullable=False)
    earned_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", backref="achievements")
    achievement = relationship("Achievement", backref="user_achievements")


class GitHubConnection(Base):
    """Stores GitHub OAuth connection for a user"""
    __tablename__ = "github_connections"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    github_user_id = Column(Integer, nullable=False)
    github_username = Column(String(100), nullable=False)
    access_token = Column(String(255), nullable=False)  # Encrypted in production
    scope = Column(String(255), nullable=True)  # OAuth scopes granted
    connected_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", backref="github_connection")


class TrackGitSync(Base):
    """Tracks GitHub sync status for a track"""
    __tablename__ = "track_git_syncs"

    id = Column(Integer, primary_key=True, index=True)
    track_id = Column(Integer, ForeignKey("tracks.id"), nullable=False, unique=True)
    repo_owner = Column(String(100), nullable=False)
    repo_name = Column(String(100), nullable=False)
    branch = Column(String(100), default="main")
    last_sync_at = Column(DateTime, nullable=True)
    last_sync_sha = Column(String(40), nullable=True)  # Git commit SHA
    sync_direction = Column(String(10), default="push")  # push, pull, both
    created_at = Column(DateTime, default=datetime.utcnow)

    track = relationship("Track", backref="git_sync")
