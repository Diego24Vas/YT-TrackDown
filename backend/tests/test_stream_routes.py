import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.adapters.stream_adapter import stream_adapter
from backend.app.domain.stream_models import StreamFormat

client = TestClient(app)

def test_build_headers_defaults_and_referer():
    headers = stream_adapter._build_headers(
        referer="https://example.com/videos/player.html",
        user_agent="CustomUA/1.0",
        origin=None,
        custom_headers={"X-Requested-With": "XMLHttpRequest"},
        cookies="session_id=12345"
    )
    assert headers["User-Agent"] == "CustomUA/1.0"
    assert headers["Referer"] == "https://example.com/videos/player.html"
    assert headers["Origin"] == "https://example.com"
    assert headers["X-Requested-With"] == "XMLHttpRequest"
    assert headers["Cookie"] == "session_id=12345"

def test_probe_stream_empty_url():
    response = client.post("/api/stream/probe", json={"url": "   "})
    assert response.status_code == 400

def test_download_stream_empty_url():
    response = client.post("/api/stream/download", json={"url": "   "})
    assert response.status_code == 400

def test_list_stream_tasks_initially():
    response = client.get("/api/stream/tasks")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_stream_task_not_found():
    response = client.get("/api/stream/tasks/nonexistent-id")
    assert response.status_code == 404
