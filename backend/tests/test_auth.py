import pytest
from fastapi.testclient import TestClient


class TestRegister:
    def test_register_success(self, client: TestClient):
        response = client.post(
            "/api/auth/register",
            json={
                "email": "newuser@example.com",
                "password": "securepass123",
                "name": "New User",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_register_duplicate_email(self, client: TestClient, test_user):
        response = client.post(
            "/api/auth/register",
            json={
                "email": "test@example.com",  # Same as test_user
                "password": "anotherpass",
                "name": "Duplicate User",
            },
        )
        assert response.status_code == 400
        assert "Email already registered" in response.json()["detail"]

    def test_register_with_org_slug(self, client: TestClient, test_org):
        response = client.post(
            "/api/auth/register",
            json={
                "email": "orguser@example.com",
                "password": "securepass123",
                "name": "Org User",
                "org_slug": "test-org",
            },
        )
        assert response.status_code == 200
        assert "access_token" in response.json()

    def test_register_invalid_org(self, client: TestClient):
        response = client.post(
            "/api/auth/register",
            json={
                "email": "badorg@example.com",
                "password": "securepass123",
                "name": "Bad Org User",
                "org_slug": "nonexistent-org",
            },
        )
        assert response.status_code == 404
        assert "Organization not found" in response.json()["detail"]


class TestLogin:
    def test_login_success(self, client: TestClient, test_user):
        response = client.post(
            "/api/auth/login",
            json={"email": "test@example.com", "password": "testpass123"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_login_wrong_password(self, client: TestClient, test_user):
        response = client.post(
            "/api/auth/login",
            json={"email": "test@example.com", "password": "wrongpassword"},
        )
        assert response.status_code == 401
        assert "Invalid email or password" in response.json()["detail"]

    def test_login_nonexistent_user(self, client: TestClient):
        response = client.post(
            "/api/auth/login",
            json={"email": "nobody@example.com", "password": "anypass"},
        )
        assert response.status_code == 401
        assert "Invalid email or password" in response.json()["detail"]


class TestMe:
    def test_me_authenticated(self, client: TestClient, test_user, auth_headers):
        response = client.get("/api/auth/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "test@example.com"
        assert data["name"] == "Test User"
        assert "organization" in data

    def test_me_unauthenticated(self, client: TestClient):
        response = client.get("/api/auth/me")
        assert response.status_code == 403  # No auth header

    def test_me_invalid_token(self, client: TestClient):
        response = client.get(
            "/api/auth/me", headers={"Authorization": "Bearer invalid-token"}
        )
        assert response.status_code == 401
