import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.domain.models import DownloadStatus
from backend.app.services.queue_service import queue_service

@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c

def test_static_index(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "YT-TrackDown" in response.text
    assert "composer-textarea" in response.text

def test_system_stats(client):
    response = client.get("/api/stats")
    assert response.status_code == 200
    data = response.json()
    assert "total_items" in data
    assert "completed" in data

def test_add_downloads_batch(client):
    payload = {
        "urls": [
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://www.youtube.com/watch?v=tPEE9ZwTmy0"
        ],
        "quality": "256"
    }
    response = client.post("/api/downloads", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 2
    assert len(data["items"]) == 2
    
    first_item = data["items"][0]
    assert first_item["quality"] == "256"
    assert first_item["status"] in ["queued", "fetching_info", "downloading", "converting", "completed"]

    # Verify listing
    res_list = client.get("/api/downloads")
    assert res_list.status_code == 200
    assert len(res_list.json()) >= 2

def test_delete_download(client):
    payload = {"urls": ["https://www.youtube.com/watch?v=test123456"], "quality": "192"}
    res = client.post("/api/downloads", json=payload)
    item_id = res.json()["items"][0]["id"]

    del_res = client.delete(f"/api/downloads/{item_id}")
    assert del_res.status_code == 200

    # Ensure not found
    get_res = client.get(f"/api/downloads/{item_id}")
    assert get_res.status_code == 404

def test_add_playlist(client, monkeypatch):
    from backend.app.adapters.ytdlp_adapter import ytdlp_adapter
    
    # Mock expand_url to return simulated playlist tracks
    monkeypatch.setattr(
        ytdlp_adapter,
        "expand_url",
        lambda url: [
            {"url": "https://www.youtube.com/watch?v=mock1", "title": "Track 1", "artist": "Artist A", "duration": 120, "thumbnail": None},
            {"url": "https://www.youtube.com/watch?v=mock2", "title": "Track 2", "artist": "Artist B", "duration": 180, "thumbnail": None},
            {"url": "https://www.youtube.com/watch?v=mock3", "title": "Track 3", "artist": "Artist C", "duration": 210, "thumbnail": None},
        ]
    )

    playlist_url = "https://www.youtube.com/playlist?list=PLmock12345"
    payload = {"urls": [playlist_url], "quality": "192"}
    res = client.post("/api/downloads", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["count"] == 3
    assert len(data["items"]) == 3
    assert [i["title"] for i in data["items"]] == ["Track 1", "Track 2", "Track 3"]

def test_preview_urls(client, monkeypatch):
    from backend.app.adapters.ytdlp_adapter import ytdlp_adapter
    monkeypatch.setattr(
        ytdlp_adapter,
        "expand_url",
        lambda url: [
            {"url": "https://www.youtube.com/watch?v=prev1", "title": "Preview Song 1", "artist": "Artist 1", "duration": 185, "duration_str": "3:05", "thumbnail": "https://thumb1.jpg"},
            {"url": "https://www.youtube.com/watch?v=prev2", "title": "Preview Song 2", "artist": "Artist 2", "duration": 240, "duration_str": "4:00", "thumbnail": "https://thumb2.jpg"},
        ]
    )

    payload = {"urls": ["https://www.youtube.com/playlist?list=PLtest"]}
    res = client.post("/api/preview", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["count"] == 2
    assert data["items"][0]["title"] == "Preview Song 1"
    assert data["items"][0]["duration_str"] == "3:05"
    assert data["items"][1]["title"] == "Preview Song 2"


