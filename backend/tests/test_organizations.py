import pytest
from fastapi.testclient import TestClient


class TestListOrganizations:
    def test_list_public_orgs(self, client: TestClient, test_org):
        """Anyone can list public organizations"""
        response = client.get("/api/organizations/public")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        # Should include the test org
        slugs = [org["slug"] for org in data]
        assert "test-org" in slugs

    def test_list_public_orgs_returns_minimal_info(self, client: TestClient, test_org):
        """Public org list should only return id, slug, name - no sensitive data"""
        response = client.get("/api/organizations/public")
        assert response.status_code == 200
        data = response.json()
        for org in data:
            assert "id" in org
            assert "slug" in org
            assert "name" in org


class TestCreateOrganization:
    def test_create_org_success(self, client: TestClient, auth_headers):
        """Authenticated users should be able to create new organizations"""
        response = client.post(
            "/api/organizations",
            json={"name": "Acme Corp", "slug": "acme-corp"},
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["slug"] == "acme-corp"
        assert data["name"] == "Acme Corp"

    def test_create_org_auto_slug(self, client: TestClient, auth_headers):
        """Slug should be auto-generated from name if not provided"""
        response = client.post(
            "/api/organizations",
            json={"name": "My Cool Company"},
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["slug"] == "my-cool-company"
        assert data["name"] == "My Cool Company"

    def test_create_org_duplicate_slug(self, client: TestClient, auth_headers, test_org):
        """Cannot create org with duplicate slug"""
        response = client.post(
            "/api/organizations",
            json={"name": "Test Org", "slug": "test-org"},  # Already exists
            headers=auth_headers,
        )
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"].lower()

    def test_create_org_requires_auth(self, client: TestClient):
        """Must be authenticated to create an organization"""
        response = client.post(
            "/api/organizations",
            json={"name": "Acme Corp"},
        )
        assert response.status_code == 403

    def test_create_org_requires_name(self, client: TestClient, auth_headers):
        """Organization name is required"""
        response = client.post(
            "/api/organizations",
            json={"slug": "some-slug"},
            headers=auth_headers,
        )
        assert response.status_code == 422


class TestGetMyOrganization:
    def test_get_my_org(self, client: TestClient, test_user, auth_headers, test_org):
        """Can get current user's organization"""
        response = client.get("/api/organizations/my", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["slug"] == "test-org"
        assert data["name"] == "Test Organization"

    def test_get_my_org_requires_auth(self, client: TestClient):
        """Must be authenticated to get my organization"""
        response = client.get("/api/organizations/my")
        assert response.status_code == 403


class TestJoinOrganization:
    def test_join_org_success(self, client: TestClient, auth_headers, db):
        """User can join an existing organization"""
        from app import models

        # Create another org to join
        other_org = models.Organization(slug="other-org", name="Other Organization")
        db.add(other_org)
        db.commit()
        db.refresh(other_org)

        response = client.post(
            f"/api/organizations/{other_org.slug}/join",
            headers=auth_headers,
        )
        assert response.status_code == 200

    def test_join_nonexistent_org(self, client: TestClient, auth_headers):
        """Cannot join an organization that doesn't exist"""
        response = client.post(
            "/api/organizations/nonexistent-org/join",
            headers=auth_headers,
        )
        assert response.status_code == 404


class TestInviteCodes:
    def test_create_invite_code(self, client: TestClient, auth_headers):
        """Can create an invite code for my organization"""
        response = client.post(
            "/api/organizations/my/invite-codes",
            json={},
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert "code" in data
        assert len(data["code"]) == 6
        assert data["is_active"] is True
        assert data["uses"] == 0

    def test_create_invite_code_with_max_uses(self, client: TestClient, auth_headers):
        """Can create invite code with usage limit"""
        response = client.post(
            "/api/organizations/my/invite-codes",
            json={"max_uses": 5},
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["max_uses"] == 5

    def test_create_invite_code_with_expiry(self, client: TestClient, auth_headers):
        """Can create invite code with expiration"""
        response = client.post(
            "/api/organizations/my/invite-codes",
            json={"expires_in_days": 7},
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["expires_at"] is not None

    def test_list_invite_codes(self, client: TestClient, auth_headers):
        """Can list my organization's invite codes"""
        # Create a code first
        client.post(
            "/api/organizations/my/invite-codes",
            json={},
            headers=auth_headers,
        )

        response = client.get(
            "/api/organizations/my/invite-codes",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_validate_invite_code_valid(self, client: TestClient, auth_headers):
        """Can validate a valid invite code"""
        # Create a code
        create_response = client.post(
            "/api/organizations/my/invite-codes",
            json={},
            headers=auth_headers,
        )
        code = create_response.json()["code"]

        # Validate it (public endpoint)
        response = client.get(f"/api/organizations/invite/{code}")
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is True
        assert data["organization"] is not None

    def test_validate_invite_code_invalid(self, client: TestClient):
        """Invalid invite code returns valid=false"""
        response = client.get("/api/organizations/invite/INVALID")
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is False
        assert "invalid" in data["message"].lower()

    def test_deactivate_invite_code(self, client: TestClient, auth_headers):
        """Can deactivate an invite code"""
        # Create a code
        create_response = client.post(
            "/api/organizations/my/invite-codes",
            json={},
            headers=auth_headers,
        )
        code = create_response.json()["code"]

        # Deactivate it
        response = client.delete(
            f"/api/organizations/my/invite-codes/{code}",
            headers=auth_headers,
        )
        assert response.status_code == 200

        # Validate should fail
        validate_response = client.get(f"/api/organizations/invite/{code}")
        assert validate_response.json()["valid"] is False

    def test_register_with_invite_code(self, client: TestClient, auth_headers, db):
        """Can register with a valid invite code"""
        # Create a code
        create_response = client.post(
            "/api/organizations/my/invite-codes",
            json={},
            headers=auth_headers,
        )
        code = create_response.json()["code"]

        # Register new user with code
        response = client.post(
            "/api/auth/register",
            json={
                "email": "invited@example.com",
                "password": "Password123",
                "name": "Invited User",
                "invite_code": code,
            },
        )
        assert response.status_code == 200
        assert "access_token" in response.json()

        # Check invite code usage incremented
        codes_response = client.get(
            "/api/organizations/my/invite-codes",
            headers=auth_headers,
        )
        codes = codes_response.json()
        invite = next(c for c in codes if c["code"] == code)
        assert invite["uses"] == 1

    def test_register_with_invalid_invite_code(self, client: TestClient):
        """Cannot register with invalid invite code"""
        response = client.post(
            "/api/auth/register",
            json={
                "email": "new@example.com",
                "password": "Password123",
                "name": "New User",
                "invite_code": "INVALID",
            },
        )
        assert response.status_code == 400
        assert "invalid" in response.json()["detail"].lower()
