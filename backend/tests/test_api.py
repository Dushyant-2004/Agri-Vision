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


def test_upload_rejects_unsupported_file_type():
    response = client.post(
        "/api/data/upload",
        files={"file": ("dataset.txt", b"not a csv", "text/plain")},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Only CSV and PDF files are supported."


def test_upload_rejects_unreadable_pdf():
    response = client.post(
        "/api/data/upload",
        files={"file": ("dataset.pdf", b"not a pdf", "application/pdf")},
    )

    assert response.status_code == 422
