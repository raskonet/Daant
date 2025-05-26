import os
from io import BytesIO

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import create_app


@pytest.fixture(scope="module")
def client():
    os.environ["CORS_ORIGINS"] = "http://testclient"
    app = create_app()
    client = TestClient(app)
    yield client


def load_sample_dicom():
    path = os.path.join(os.path.dirname(__file__), "sample.dcm")
    with open(path, "rb") as f:
        return f.read()


def test_settings_defaults(tmp_path, monkeypatch):
    monkeypatch.delenv("PROJECT_NAME", raising=False)
    cfg = settings
    assert cfg.PROJECT_NAME == "Dental X-ray DICOM Viewer"
    assert cfg.API_STR == "/api/v1"
    assert isinstance(cfg.CORS_ORIGINS, list)


def test_healthz(client):
    resp = client.get(f"{settings.API_STR}/healthz")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_upload_invalid_type(client):
    files = {"file": ("image.png", BytesIO(b"not-a-dicm"), "image/png")}
    resp = client.post(f"{settings.API_STR}/upload", files=files)
    assert resp.status_code == 400
    assert "Only DICOM files allowed" in resp.text


def test_upload_and_fetch(client):
    dicom_bytes = load_sample_dicom()
    files = {"file": ("sample.dcm", BytesIO(dicom_bytes), "application/dicom")}
    upload_resp = client.post(f"{settings.API_STR}/upload", files=files)
    assert upload_resp.status_code == 200
    dicom_id = upload_resp.json()
    assert isinstance(dicom_id, str)

    fetch_resp = client.get(f"{settings.API_STR}/dicom/{dicom_id}")
    assert fetch_resp.status_code == 200
    data = fetch_resp.json()
    assert "png_data" in data
    assert "meta" in data
    assert "pixel_spacing" in data["meta"]
    assert isinstance(data["meta"]["pixel_spacing"], list)


def test_fetch_not_found(client):
    resp = client.get(f"{settings.API_STR}/dicom/nonexistent-id")
    assert resp.status_code == 404
    assert "DICOM not found" in resp.text
