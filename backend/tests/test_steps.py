import pytest
from fastapi.testclient import TestClient


class TestCreateStep:
    def test_create_step_success(self, client: TestClient, test_track, author_headers):
        response = client.post(
            f"/api/tracks/{test_track.slug}/steps",
            headers=author_headers,
            json={
                "title": "New Step",
                "instructions_md": "# Instructions\n\nDo this.",
                "setup_script": "echo 'setting up'",
                "validation_script": "echo 'validating'",
                "hints": ["Try this", "Or that"],
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "New Step"
        assert data["order"] == 1  # First step

    def test_create_step_auto_ordering(
        self, client: TestClient, test_track, test_step, author_headers
    ):
        response = client.post(
            f"/api/tracks/{test_track.slug}/steps",
            headers=author_headers,
            json={"title": "Second Step"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["order"] == 2  # Second step

    def test_create_step_track_not_found(self, client: TestClient, author_headers):
        response = client.post(
            "/api/tracks/nonexistent/steps",
            headers=author_headers,
            json={"title": "Ghost Step"},
        )
        assert response.status_code == 404

    def test_create_step_unauthenticated(self, client: TestClient, test_track):
        response = client.post(
            f"/api/tracks/{test_track.slug}/steps",
            json={"title": "Unauth Step"},
        )
        assert response.status_code == 403


class TestGetStep:
    def test_get_step_success(
        self, client: TestClient, test_track, test_step, author_headers
    ):
        response = client.get(
            f"/api/tracks/{test_track.slug}/steps/{test_step.id}",
            headers=author_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_step.id
        assert data["title"] == "Test Step"

    def test_get_step_not_found(
        self, client: TestClient, test_track, author_headers
    ):
        response = client.get(
            f"/api/tracks/{test_track.slug}/steps/99999",
            headers=author_headers,
        )
        assert response.status_code == 404


class TestUpdateStep:
    def test_update_step_success(
        self, client: TestClient, test_track, test_step, author_headers
    ):
        response = client.patch(
            f"/api/tracks/{test_track.slug}/steps/{test_step.id}",
            headers=author_headers,
            json={"title": "Updated Step Title", "instructions_md": "# Updated"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Updated Step Title"
        assert data["instructions_md"] == "# Updated"

    def test_update_step_not_found(
        self, client: TestClient, test_track, author_headers
    ):
        response = client.patch(
            f"/api/tracks/{test_track.slug}/steps/99999",
            headers=author_headers,
            json={"title": "Ghost"},
        )
        assert response.status_code == 404


class TestDeleteStep:
    def test_delete_step_success(
        self, client: TestClient, test_track, test_step, author_headers
    ):
        response = client.delete(
            f"/api/tracks/{test_track.slug}/steps/{test_step.id}",
            headers=author_headers,
        )
        assert response.status_code == 204

    def test_delete_step_not_found(
        self, client: TestClient, test_track, author_headers
    ):
        response = client.delete(
            f"/api/tracks/{test_track.slug}/steps/99999",
            headers=author_headers,
        )
        assert response.status_code == 404


class TestStepReordering:
    def test_reorder_step(self, client: TestClient, test_track, author_headers, db):
        # Create multiple steps
        for i, title in enumerate(["Step A", "Step B", "Step C"], 1):
            client.post(
                f"/api/tracks/{test_track.slug}/steps",
                headers=author_headers,
                json={"title": title},
            )

        # Get all steps
        track_response = client.get(f"/api/tracks/{test_track.slug}")
        steps = track_response.json()["steps"]
        step_a = next(s for s in steps if s["title"] == "Step A")

        # Move Step A from position 1 to position 3
        response = client.patch(
            f"/api/tracks/{test_track.slug}/steps/{step_a['id']}",
            headers=author_headers,
            json={"order": 3},
        )
        assert response.status_code == 200
        assert response.json()["order"] == 3
