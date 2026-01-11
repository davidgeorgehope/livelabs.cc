"""Tests for achievements endpoints"""
import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from app import models


class TestListAchievements:
    """Test listing all achievements"""

    def test_list_all_achievements(self, client: TestClient):
        """Should return list of all achievements"""
        response = client.get("/api/achievements/all")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should have seeded achievements
        assert len(data) >= 4

    def test_achievements_have_correct_fields(self, client: TestClient):
        """Achievements should have all required fields"""
        response = client.get("/api/achievements/all")
        data = response.json()
        if len(data) > 0:
            achievement = data[0]
            assert "id" in achievement
            assert "slug" in achievement
            assert "name" in achievement
            assert "description" in achievement
            assert "icon" in achievement
            assert "color" in achievement
            assert "xp_value" in achievement


class TestUserStats:
    """Test getting user stats and achievements"""

    def test_get_my_stats_requires_auth(self, client: TestClient):
        """Should require authentication"""
        response = client.get("/api/achievements/my")
        assert response.status_code == 403

    def test_get_my_stats_empty(self, client: TestClient, auth_headers):
        """New user should have zero stats"""
        response = client.get("/api/achievements/my", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total_xp"] == 0
        assert data["tracks_completed"] == 0
        assert data["achievements_count"] == 0
        assert data["achievements"] == []

    def test_get_my_stats_with_completed_track(self, client: TestClient, db, test_user, auth_headers, test_track, test_step):
        """Should show stats after completing a track"""
        # Create an enrollment
        enrollment = models.Enrollment(
            user_id=test_user.id,
            track_id=test_track.id,
            current_step=2,  # Beyond last step
            environment={},
            completed_at=datetime.utcnow()
        )
        db.add(enrollment)
        db.commit()

        response = client.get("/api/achievements/my", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["tracks_completed"] == 1
        # Should have earned "first_track" achievement
        assert data["achievements_count"] >= 1
        assert data["total_xp"] >= 100  # first_track gives 100 XP

    def test_achievement_awarded_automatically(self, client: TestClient, db, test_user, auth_headers, test_track, test_step):
        """Achievements should be awarded automatically when criteria met"""
        # Create completed enrollment
        enrollment = models.Enrollment(
            user_id=test_user.id,
            track_id=test_track.id,
            current_step=2,
            environment={},
            completed_at=datetime.utcnow()
        )
        db.add(enrollment)
        db.commit()

        response = client.get("/api/achievements/my", headers=auth_headers)
        data = response.json()

        # Find the first_track achievement
        first_track = None
        for ua in data["achievements"]:
            if ua["achievement"]["slug"] == "first_track":
                first_track = ua
                break

        assert first_track is not None
        assert first_track["achievement"]["name"] == "First Steps"
        assert first_track["earned_at"] is not None


class TestCertificates:
    """Test certificate generation"""

    def test_get_certificate_requires_auth(self, client: TestClient):
        """Should require authentication"""
        response = client.get("/api/achievements/certificate/1")
        assert response.status_code == 403

    def test_get_certificate_not_found(self, client: TestClient, auth_headers):
        """Should return 404 for non-existent enrollment"""
        response = client.get("/api/achievements/certificate/999", headers=auth_headers)
        assert response.status_code == 404

    def test_get_certificate_not_completed(self, client: TestClient, auth_headers, test_enrollment):
        """Should return 400 for incomplete track"""
        response = client.get(f"/api/achievements/certificate/{test_enrollment.id}", headers=auth_headers)
        assert response.status_code == 400
        assert "not yet completed" in response.json()["detail"]

    def test_get_certificate_success(self, client: TestClient, db, auth_headers, test_enrollment):
        """Should return certificate data for completed track"""
        # Mark enrollment as completed
        test_enrollment.completed_at = datetime.utcnow()
        db.commit()

        response = client.get(f"/api/achievements/certificate/{test_enrollment.id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "user_name" in data
        assert "track_title" in data
        assert "completed_at" in data
        assert "certificate_id" in data
        assert data["user_name"] == "Test User"
        assert data["track_title"] == "Test Track"

    def test_certificate_id_is_deterministic(self, client: TestClient, db, auth_headers, test_enrollment):
        """Same enrollment should always produce same certificate ID"""
        # Mark enrollment as completed
        test_enrollment.completed_at = datetime.utcnow()
        db.commit()

        response1 = client.get(f"/api/achievements/certificate/{test_enrollment.id}", headers=auth_headers)
        response2 = client.get(f"/api/achievements/certificate/{test_enrollment.id}", headers=auth_headers)

        assert response1.json()["certificate_id"] == response2.json()["certificate_id"]

    def test_cannot_get_other_user_certificate(self, client: TestClient, db, test_org, test_track, test_step):
        """Should not be able to get certificate for another user's enrollment"""
        from app.auth import get_password_hash, create_access_token

        # Create first user with completed enrollment
        user1 = models.User(
            email="user1@test.com",
            hashed_password=get_password_hash("Password123"),
            name="User One",
            org_id=test_org.id
        )
        db.add(user1)
        db.commit()
        db.refresh(user1)

        enrollment = models.Enrollment(
            user_id=user1.id,
            track_id=test_track.id,
            current_step=2,
            environment={},
            completed_at=datetime.utcnow()
        )
        db.add(enrollment)
        db.commit()
        db.refresh(enrollment)

        # Create second user
        user2 = models.User(
            email="user2@test.com",
            hashed_password=get_password_hash("Password123"),
            name="User Two",
            org_id=test_org.id
        )
        db.add(user2)
        db.commit()
        db.refresh(user2)

        token2 = create_access_token(data={"sub": user2.id})
        headers2 = {"Authorization": f"Bearer {token2}"}

        # Try to get first user's certificate
        response = client.get(f"/api/achievements/certificate/{enrollment.id}", headers=headers2)
        assert response.status_code == 404
