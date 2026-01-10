import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import Base, get_db
from app.auth import get_password_hash, create_access_token
from app import models

# In-memory SQLite for testing - use StaticPool to share connection
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db():
    """Create a fresh database for each test."""
    # Create all tables
    Base.metadata.create_all(bind=engine)

    # Create a scoped session that all code will share
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    # Override the dependency to return sessions from the same connection
    def override_get_db():
        try:
            yield session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    yield session

    # Cleanup
    session.close()
    transaction.rollback()
    connection.close()
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db):
    """Create a test client with the test database."""
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def test_org(db):
    """Create a test organization."""
    org = models.Organization(slug="test-org", name="Test Organization")
    db.add(org)
    db.commit()
    db.refresh(org)
    return org


@pytest.fixture
def test_user(db, test_org):
    """Create a test user."""
    user = models.User(
        email="test@example.com",
        hashed_password=get_password_hash("testpass123"),
        name="Test User",
        is_author=False,
        org_id=test_org.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def test_author(db, test_org):
    """Create a test author user."""
    author = models.User(
        email="author@example.com",
        hashed_password=get_password_hash("authorpass123"),
        name="Test Author",
        is_author=True,
        org_id=test_org.id,
    )
    db.add(author)
    db.commit()
    db.refresh(author)
    return author


@pytest.fixture
def user_token(test_user):
    """Get a JWT token for the test user."""
    return create_access_token(data={"sub": test_user.id})


@pytest.fixture
def author_token(test_author):
    """Get a JWT token for the test author."""
    return create_access_token(data={"sub": test_author.id})


@pytest.fixture
def auth_headers(user_token):
    """Get authorization headers for the test user."""
    return {"Authorization": f"Bearer {user_token}"}


@pytest.fixture
def author_headers(author_token):
    """Get authorization headers for the test author."""
    return {"Authorization": f"Bearer {author_token}"}


@pytest.fixture
def test_track(db, test_author, test_org):
    """Create a test track."""
    track = models.Track(
        slug="test-track",
        title="Test Track",
        description="A test track for testing",
        docker_image="test-image:latest",
        is_published=True,
        author_id=test_author.id,
        org_id=test_org.id,
        env_template=[
            {"name": "API_KEY", "description": "Test API key", "required": True}
        ],
    )
    db.add(track)
    db.commit()
    db.refresh(track)
    return track


@pytest.fixture
def test_step(db, test_track):
    """Create a test step."""
    step = models.Step(
        track_id=test_track.id,
        order=1,
        title="Test Step",
        instructions_md="# Test Step\n\nDo something.",
        setup_script="echo 'setup'",
        validation_script="echo 'valid'",
        hints=["Hint 1", "Hint 2"],
    )
    db.add(step)
    db.commit()
    db.refresh(step)
    return step


@pytest.fixture
def test_enrollment(db, test_user, test_track):
    """Create a test enrollment."""
    enrollment = models.Enrollment(
        user_id=test_user.id,
        track_id=test_track.id,
        current_step=1,
        environment={"API_KEY": "test-key-123"},
    )
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)
    return enrollment
