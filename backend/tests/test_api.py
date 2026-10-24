from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "agrivision-analytics",
    }


def test_upload_rejects_non_csv():
    response = client.post(
        "/api/data/upload",
        files={"file": ("dataset.txt", b"not a csv", "text/plain")},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Only CSV files are supported."

