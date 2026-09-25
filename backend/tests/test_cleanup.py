import os
import time
from datetime import datetime, timedelta
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.core.config import settings
from backend.app.adapters.storage_adapter import storage_adapter
from backend.app.domain.models import DownloadItem, DownloadStatus
from backend.app.services.queue_service import queue_service

@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c

def test_storage_adapter_clean_old_files(tmp_path):
    """Verifies storage adapter removes files older than threshold and preserves recent ones."""
    test_storage = storage_adapter
    downloads_dir = settings.DOWNLOADS_DIR

    # Create an old file (> 15 minutes old: 1000 seconds ago)
    old_file = downloads_dir / "old_test_track.mp3"
    old_file.write_text("dummy old mp3 content")
    old_mtime = time.time() - 1000
    os.utime(old_file, (old_mtime, old_mtime))

    # Create a fresh file (10 seconds ago)
    fresh_file = downloads_dir / "fresh_test_track.mp3"
    fresh_file.write_text("dummy fresh mp3 content")

    # Create an active download file that is old, but belongs to active_ids
    active_old_file = downloads_dir / "act12345_in_progress.part"
    active_old_file.write_text("partial download")
    os.utime(active_old_file, (old_mtime, old_mtime))

    # Run cleanup with 900 seconds (15 min) threshold
    deleted = test_storage.clean_old_files(max_age_seconds=900, active_ids={"act12345"})

    assert "old_test_track.mp3" in deleted
    assert not old_file.exists()
    assert fresh_file.exists()
    assert active_old_file.exists()

    # Clean up test files
    if fresh_file.exists():
        fresh_file.unlink()
    if active_old_file.exists():
        active_old_file.unlink()

@pytest.mark.anyio
async def test_queue_service_perform_cleanup():
    """Verifies QueueService marks completed items as EXPIRED when files age past retention."""
    downloads_dir = settings.DOWNLOADS_DIR
    dummy_file = downloads_dir / "item_expire_test.mp3"
    dummy_file.write_text("dummy mp3 content")
    old_mtime = time.time() - 950
    os.utime(dummy_file, (old_mtime, old_mtime))

    item = DownloadItem(
        id="test_exp_1",
        url="https://www.youtube.com/watch?v=mockexp",
        title="Expiring Track",
        filename="item_expire_test.mp3",
        status=DownloadStatus.COMPLETED,
        completed_at=(datetime.now() - timedelta(minutes=16)).isoformat(),
    )
    queue_service._items[item.id] = item

    await queue_service.perform_cleanup()

    assert item.status == DownloadStatus.EXPIRED
    assert not dummy_file.exists()

def test_expired_file_download_endpoint_returns_410(client):
    """Attempting to download a file from an expired item should return HTTP 410 Gone."""
    item = DownloadItem(
        id="test_exp_410",
        url="https://www.youtube.com/watch?v=mock410",
        title="410 Track",
        filename="non_existent.mp3",
        status=DownloadStatus.EXPIRED,
    )
    queue_service._items[item.id] = item

    res = client.get(f"/api/downloads/{item.id}/file")
    assert res.status_code == 410
    assert "expirado" in res.json()["detail"].lower()

def test_retry_expired_item(client):
    """Re-trying an expired item should return it to QUEUED status."""
    item = DownloadItem(
        id="test_exp_retry",
        url="https://www.youtube.com/watch?v=mockretry",
        title="Retry Track",
        filename="old_file.mp3",
        status=DownloadStatus.EXPIRED,
    )
    queue_service._items[item.id] = item

    res = client.post(f"/api/downloads/{item.id}/retry")
    assert res.status_code == 200
    assert res.json()["status"] == DownloadStatus.QUEUED.value
    assert res.json()["filename"] is None

def test_clear_completed_clears_expired(client):
    """Calling clear-completed should also clear items with EXPIRED status."""
    item_comp = DownloadItem(
        id="test_clear_comp",
        url="https://www.youtube.com/watch?v=c1",
        title="Comp",
        status=DownloadStatus.COMPLETED,
    )
    item_exp = DownloadItem(
        id="test_clear_exp",
        url="https://www.youtube.com/watch?v=c2",
        title="Exp",
        status=DownloadStatus.EXPIRED,
    )
    queue_service._items[item_comp.id] = item_comp
    queue_service._items[item_exp.id] = item_exp

    res = client.post("/api/downloads/clear-completed")
    assert res.status_code == 200
    assert item_comp.id not in queue_service._items
    assert item_exp.id not in queue_service._items
