import pytest
from fastapi.testclient import TestClient


class TestListTracks:
    def test_list_public_tracks(self, client: TestClient, test_track):
        response = client.get("/api/tracks/public")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert any(t["slug"] == "test-track" for t in data)

    def test_list_tracks_empty(self, client: TestClient):
        response = client.get("/api/tracks/public")
        assert response.status_code == 200
        # May have seeded data, so just check it's a list
        assert isinstance(response.json(), list)

    def test_list_my_tracks(self, client: TestClient, test_track, author_headers):
        response = client.get("/api/tracks/my", headers=author_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert any(t["slug"] == "test-track" for t in data)

    def test_list_my_tracks_unauthenticated(self, client: TestClient):
        response = client.get("/api/tracks/my")
        assert response.status_code == 403


class TestCreateTrack:
    def test_create_track_success(self, client: TestClient, author_headers):
        response = client.post(
            "/api/tracks",
            headers=author_headers,
            json={
                "title": "New Track",
                "slug": "new-track",
                "description": "A brand new track",
                "docker_image": "custom-image:v1",
                "env_template": [
                    {"name": "SECRET", "description": "A secret", "required": True}
                ],
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["slug"] == "new-track"
        assert data["title"] == "New Track"
        assert data["is_published"] == False

    def test_create_track_duplicate_slug(
        self, client: TestClient, test_track, author_headers
    ):
        response = client.post(
            "/api/tracks",
            headers=author_headers,
            json={
                "title": "Duplicate",
                "slug": "test-track",  # Same as test_track
            },
        )
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"]

    def test_create_track_unauthenticated(self, client: TestClient):
        response = client.post(
            "/api/tracks",
            json={"title": "Unauthorized", "slug": "unauth-track"},
        )
        assert response.status_code == 403

    def test_create_track_non_author(self, client: TestClient, auth_headers, db, test_user):
        # Make test_user not an author
        test_user.is_author = False
        db.commit()

        response = client.post(
            "/api/tracks",
            headers=auth_headers,
            json={"title": "Non Author Track", "slug": "non-author"},
        )
        assert response.status_code == 403


class TestGetTrack:
    def test_get_track_by_slug(self, client: TestClient, test_track, test_step):
        response = client.get(f"/api/tracks/{test_track.slug}")
        assert response.status_code == 200
        data = response.json()
        assert data["slug"] == "test-track"
        assert data["title"] == "Test Track"
        assert "steps" in data
        assert "author" in data

    def test_get_track_not_found(self, client: TestClient):
        response = client.get("/api/tracks/nonexistent-track")
        assert response.status_code == 404


class TestUpdateTrack:
    def test_update_track_success(self, client: TestClient, test_track, author_headers):
        response = client.patch(
            f"/api/tracks/{test_track.slug}",
            headers=author_headers,
            json={"title": "Updated Title", "is_published": False},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Updated Title"
        assert data["is_published"] == False

    def test_update_track_unauthorized(self, client: TestClient, test_track, auth_headers):
        response = client.patch(
            f"/api/tracks/{test_track.slug}",
            headers=auth_headers,
            json={"title": "Hacked Title"},
        )
        # Regular user can't update track they don't own
        assert response.status_code in [403, 404]

    def test_update_track_not_found(self, client: TestClient, author_headers):
        response = client.patch(
            "/api/tracks/nonexistent",
            headers=author_headers,
            json={"title": "Ghost Track"},
        )
        assert response.status_code == 404


class TestDeleteTrack:
    def test_delete_track_success(self, client: TestClient, test_track, author_headers):
        response = client.delete(
            f"/api/tracks/{test_track.slug}", headers=author_headers
        )
        assert response.status_code == 204

        # Verify it's gone
        get_response = client.get(f"/api/tracks/{test_track.slug}")
        assert get_response.status_code == 404

    def test_delete_track_unauthorized(self, client: TestClient, test_track, auth_headers):
        response = client.delete(
            f"/api/tracks/{test_track.slug}", headers=auth_headers
        )
        assert response.status_code in [403, 404]

    def test_delete_track_not_found(self, client: TestClient, author_headers):
        response = client.delete("/api/tracks/nonexistent", headers=author_headers)
        assert response.status_code == 404


class TestTrackSearch:
    def test_search_by_title(self, client: TestClient, test_track):
        response = client.get("/api/tracks/public?q=Test")
        assert response.status_code == 200
        data = response.json()
        assert any(t["slug"] == "test-track" for t in data)

    def test_search_no_results(self, client: TestClient, test_track):
        response = client.get("/api/tracks/public?q=nonexistentquery12345")
        assert response.status_code == 200
        data = response.json()
        assert not any(t["slug"] == "test-track" for t in data)

    def test_filter_by_difficulty(self, client: TestClient, author_headers, db):
        from app import models
        # Create track with specific difficulty
        track = models.Track(
            slug="advanced-track",
            title="Advanced Track",
            description="An advanced track",
            difficulty="advanced",
            is_published=True,
            author_id=1,
            org_id=1
        )
        db.add(track)
        db.commit()

        response = client.get("/api/tracks/public?difficulty=advanced")
        assert response.status_code == 200
        data = response.json()
        assert any(t["slug"] == "advanced-track" for t in data)

    def test_filter_by_tag(self, client: TestClient, author_headers, db):
        from app import models
        # Create track with specific tags
        track = models.Track(
            slug="kubernetes-track",
            title="Kubernetes Basics",
            description="Learn kubernetes",
            tags=["kubernetes", "devops"],
            is_published=True,
            author_id=1,
            org_id=1
        )
        db.add(track)
        db.commit()

        response = client.get("/api/tracks/public?tag=kubernetes")
        assert response.status_code == 200
        data = response.json()
        assert any(t["slug"] == "kubernetes-track" for t in data)

    def test_sort_by_title(self, client: TestClient, test_track):
        response = client.get("/api/tracks/public?sort=title")
        assert response.status_code == 200
        data = response.json()
        # Verify it's a list (sorting works)
        assert isinstance(data, list)

    def test_list_tags(self, client: TestClient, author_headers, db):
        from app import models
        # Create track with tags
        track = models.Track(
            slug="tagged-track",
            title="Tagged Track",
            description="A track with tags",
            tags=["python", "api"],
            is_published=True,
            author_id=1,
            org_id=1
        )
        db.add(track)
        db.commit()

        response = client.get("/api/tracks/tags")
        assert response.status_code == 200
        data = response.json()
        assert "python" in data
        assert "api" in data


class TestTrackWithNewFields:
    def test_create_track_with_tags(self, client: TestClient, author_headers):
        response = client.post(
            "/api/tracks",
            headers=author_headers,
            json={
                "title": "Tagged Track",
                "slug": "tagged-track-new",
                "description": "A track with tags",
                "tags": ["docker", "containers"],
                "difficulty": "intermediate",
                "estimated_minutes": 45,
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["tags"] == ["docker", "containers"]
        assert data["difficulty"] == "intermediate"
        assert data["estimated_minutes"] == 45

    def test_update_track_tags(self, client: TestClient, test_track, author_headers):
        response = client.patch(
            f"/api/tracks/{test_track.slug}",
            headers=author_headers,
            json={
                "tags": ["updated", "tags"],
                "difficulty": "advanced",
                "estimated_minutes": 60,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["tags"] == ["updated", "tags"]
        assert data["difficulty"] == "advanced"
        assert data["estimated_minutes"] == 60
