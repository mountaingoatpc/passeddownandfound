from fastapi.testclient import TestClient


def test_health_returns_ok(api_app) -> None:
    with TestClient(api_app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"message": "healthy"}
