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
    env_template = Column(JSON, default=list)  # List of {name, description, required}
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
