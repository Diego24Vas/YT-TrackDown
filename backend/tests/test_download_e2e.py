import time
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.domain.models import DownloadStatus

@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c

def test_download_process_e2e(client):
    # Short 1 second video: https://www.youtube.com/watch?v=tPEE9ZwTmy0
    payload = {
        "urls": ["https://www.youtube.com/watch?v=tPEE9ZwTmy0"],
        "quality": "128"
    }
    response = client.post("/api/downloads", json=payload)
    assert response.status_code == 200
    item_id = response.json()["items"][0]["id"]

    # Poll status until completed or timeout (15s max)
    start_time = time.time()
    completed = False
    while time.time() - start_time < 20:
        res = client.get(f"/api/downloads/{item_id}")
        assert res.status_code == 200
        data = res.json()
        if data["status"] == DownloadStatus.COMPLETED.value:
            completed = True
            break
        elif data["status"] == DownloadStatus.ERROR.value:
            pytest.fail(f"Download failed with error: {data.get('error_message')}")
        time.sleep(1)

    assert completed, "Download did not complete in time"

    # Verify download file endpoint returns the MP3
    file_res = client.get(f"/api/downloads/{item_id}/file")
    assert file_res.status_code == 200
    assert file_res.headers["content-type"] == "audio/mpeg"
    assert len(file_res.content) > 1000

    # Verify ZIP export endpoint
    zip_res = client.get("/api/downloads/export/zip")
    assert zip_res.status_code == 200
    assert zip_res.headers["content-type"] == "application/zip"
    assert len(zip_res.content) > 1000
