import pytest
from fastapi.testclient import TestClient


class TestCORS:
    def test_cors_allows_production_domain(self, client: TestClient):
        """CORS should allow requests from livelabs.cc"""
        response = client.options(
            "/api/auth/login",
            headers={
                "Origin": "https://livelabs.cc",
                "Access-Control-Request-Method": "POST",
            },
        )
        assert response.status_code == 200
        allow_origin = response.headers.get("access-control-allow-origin", "")
        assert "https://livelabs.cc" in allow_origin or allow_origin == "*"

    def test_cors_allows_www_production_domain(self, client: TestClient):
        """CORS should allow requests from www.livelabs.cc"""
        response = client.options(
            "/api/auth/login",
            headers={
                "Origin": "https://www.livelabs.cc",
                "Access-Control-Request-Method": "POST",
            },
        )
        assert response.status_code == 200
        allow_origin = response.headers.get("access-control-allow-origin", "")
        assert "https://www.livelabs.cc" in allow_origin or allow_origin == "*"

    def test_cors_allows_localhost(self, client: TestClient):
        """CORS should still allow localhost for development"""
        response = client.options(
            "/api/auth/login",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
            },
        )
        assert response.status_code == 200
        allow_origin = response.headers.get("access-control-allow-origin", "")
        assert "localhost:3000" in allow_origin or allow_origin == "*"

    def test_cors_allows_credentials(self, client: TestClient):
        """CORS should allow credentials"""
        response = client.options(
            "/api/auth/login",
            headers={
                "Origin": "https://livelabs.cc",
                "Access-Control-Request-Method": "POST",
            },
        )
        assert response.headers.get("access-control-allow-credentials") == "true"
