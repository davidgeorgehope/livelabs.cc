import pytest
from fastapi.testclient import TestClient


class TestListEnrollments:
    def test_list_enrollments_empty(self, client: TestClient, auth_headers):
        response = client.get("/api/enrollments", headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == []

    def test_list_enrollments_with_data(
        self, client: TestClient, test_enrollment, auth_headers
    ):
        response = client.get("/api/enrollments", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == test_enrollment.id
        assert "track" in data[0]

    def test_list_enrollments_unauthenticated(self, client: TestClient):
        response = client.get("/api/enrollments")
        assert response.status_code == 403


class TestCreateEnrollment:
    def test_enroll_success(self, client: TestClient, test_track, auth_headers):
        response = client.post(
            "/api/enrollments",
            headers=auth_headers,
            json={
                "track_slug": test_track.slug,
                "environment": {"API_KEY": "my-secret-key"},
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["track_id"] == test_track.id
        assert data["current_step"] == 1
        assert data["environment"]["API_KEY"] == "my-secret-key"

    def test_enroll_track_not_found(self, client: TestClient, auth_headers):
        response = client.post(
            "/api/enrollments",
            headers=auth_headers,
            json={"track_slug": "nonexistent", "environment": {}},
        )
        assert response.status_code == 404

    def test_enroll_duplicate(
        self, client: TestClient, test_track, test_enrollment, auth_headers
    ):
        response = client.post(
            "/api/enrollments",
            headers=auth_headers,
            json={
                "track_slug": test_track.slug,
                "environment": {"API_KEY": "another-key"},
            },
        )
        assert response.status_code == 400
        assert "Already enrolled" in response.json()["detail"]

    def test_enroll_missing_required_env(self, client: TestClient, test_track, auth_headers):
        response = client.post(
            "/api/enrollments",
            headers=auth_headers,
            json={
                "track_slug": test_track.slug,
                "environment": {},  # Missing required API_KEY
            },
        )
        assert response.status_code == 400
        assert "Missing required" in response.json()["detail"]


class TestGetEnrollment:
    def test_get_enrollment_success(
        self, client: TestClient, test_enrollment, test_step, auth_headers
    ):
        response = client.get(
            f"/api/enrollments/{test_enrollment.id}", headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_enrollment.id
        assert "track" in data
        assert "steps" in data["track"]

    def test_get_enrollment_not_found(self, client: TestClient, auth_headers):
        response = client.get("/api/enrollments/99999", headers=auth_headers)
        assert response.status_code == 404

    def test_get_enrollment_other_user(
        self, client: TestClient, test_enrollment, author_headers
    ):
        # Author trying to access test_user's enrollment
        response = client.get(
            f"/api/enrollments/{test_enrollment.id}", headers=author_headers
        )
        assert response.status_code == 404  # Not found for this user


class TestUpdateEnrollmentEnv:
    def test_update_env_success(
        self, client: TestClient, test_enrollment, auth_headers
    ):
        response = client.patch(
            f"/api/enrollments/{test_enrollment.id}/environment",
            headers=auth_headers,
            json={"NEW_VAR": "new-value", "API_KEY": "updated-key"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["environment"]["NEW_VAR"] == "new-value"
        assert data["environment"]["API_KEY"] == "updated-key"

    def test_update_env_not_found(self, client: TestClient, auth_headers):
        response = client.patch(
            "/api/enrollments/99999/environment",
            headers=auth_headers,
            json={"VAR": "value"},
        )
        assert response.status_code == 404


class TestDeleteEnrollment:
    def test_unenroll_success(
        self, client: TestClient, test_enrollment, auth_headers
    ):
        response = client.delete(
            f"/api/enrollments/{test_enrollment.id}", headers=auth_headers
        )
        assert response.status_code == 204

        # Verify it's gone
        get_response = client.get(
            f"/api/enrollments/{test_enrollment.id}", headers=auth_headers
        )
        assert get_response.status_code == 404

    def test_unenroll_not_found(self, client: TestClient, auth_headers):
        response = client.delete("/api/enrollments/99999", headers=auth_headers)
        assert response.status_code == 404
