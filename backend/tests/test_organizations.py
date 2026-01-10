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
