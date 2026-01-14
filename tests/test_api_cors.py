from __future__ import annotations

from fastapi.testclient import TestClient

from dipdetector.api.main import app


def test_cors_preflight_allows_localhost():
    client = TestClient(app)
    response = client.options(
        "/health",
        headers={
            "Origin": "http://localhost:8081",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:8081"
