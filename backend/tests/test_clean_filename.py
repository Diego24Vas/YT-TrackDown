import os
import zipfile
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.adapters.storage_adapter import storage_adapter
from backend.app.domain.models import DownloadItem, DownloadStatus
from backend.app.services.queue_service import queue_service

@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c

def test_clean_display_filename():
    assert storage_adapter.clean_display_filename("2a9adcff34_Milo J - Solifican12.mp3") == "Milo J - Solifican12.mp3"
    assert storage_adapter.clean_display_filename("abcdef0123_Track Name.mp3") == "Track Name.mp3"
    assert storage_adapter.clean_display_filename("Track Name.mp3") == "Track Name.mp3"
    assert storage_adapter.clean_display_filename("2a9adcff34_") == "2a9adcff34_"

def test_clean_display_filename_strips_video_oficial():
    assert storage_adapter.clean_display_filename("2a9adcff34_Milo J - Solifican12 (Video Oficial).mp3") == "Milo J - Solifican12.mp3"
    assert storage_adapter.clean_display_filename("Milo J - Solifican12 (video oficial).mp3") == "Milo J - Solifican12.mp3"
    assert storage_adapter.clean_display_filename("Milo J - Solifican12 [Video Oficial].mp3") == "Milo J - Solifican12.mp3"
    assert storage_adapter.clean_display_filename("Milo J - Solifican12 (VIDEO OFICIAL)") == "Milo J - Solifican12"
    assert storage_adapter.clean_display_filename("Duki - Givenchy (Official Video).mp3") == "Duki - Givenchy.mp3"
    assert storage_adapter.clean_display_filename("Bad Bunny - Tití Me Preguntó - Video Oficial.mp3") == "Bad Bunny - Tití Me Preguntó.mp3"
    assert storage_adapter.clean_display_filename("Bizarrap - Bzrp Music Sessions, Vol. 50 (Video Oficial).mp3") == "Bizarrap - Bzrp Music Sessions, Vol. 50.mp3"
    assert storage_adapter.clean_display_filename("2a9adcff34_Milo J - Solifican12 (Visualizer).mp3") == "Milo J - Solifican12.mp3"
    assert storage_adapter.clean_display_filename("Bizarrap - Vol. 53 [Visualizer].mp3") == "Bizarrap - Vol. 53.mp3"
    assert storage_adapter.clean_display_filename("Duki - Top 5 (Official Visualizer).mp3") == "Duki - Top 5.mp3"
    assert storage_adapter.clean_display_filename("Travis Scott - FE!N - Visualizer.mp3") == "Travis Scott - FE!N.mp3"

def test_create_zip_clean_names(tmp_path):
    storage = storage_adapter
    # Create mock audio files in downloads dir
    f1_name = "2a9adcff34_Song One (Video Oficial).mp3"
    f2_name = "bbbb111122_Song Two.mp3"
    f3_name = "cccc222233_Song One.mp3" # duplicate title

    p1 = storage.base_dir / f1_name
    p2 = storage.base_dir / f2_name
    p3 = storage.base_dir / f3_name

    p1.write_text("audio1")
    p2.write_text("audio2")
    p3.write_text("audio3")

    zip_path = storage.create_zip([f1_name, f2_name, f3_name], zip_name="test_clean_export.zip")
    assert zip_path.is_file()

    with zipfile.ZipFile(zip_path, "r") as zf:
        namelist = zf.namelist()
        assert "Song One.mp3" in namelist
        assert "Song Two.mp3" in namelist
        assert "Song One (1).mp3" in namelist
        # Verify NO prefix or (Video Oficial) exists in any zip entry
        for name in namelist:
            assert not name.startswith("2a9adcff34_")
            assert not name.startswith("bbbb111122_")
            assert not name.startswith("cccc222233_")
            assert "Video Oficial" not in name

    # Clean up test files
    p1.unlink(missing_ok=True)
    p2.unlink(missing_ok=True)
    p3.unlink(missing_ok=True)
    zip_path.unlink(missing_ok=True)

def test_download_mp3_file_content_disposition(client):
    test_id = "testhex012"
    file_name = f"{test_id}_Milo J - Solifican12.mp3"
    file_path = storage_adapter.base_dir / file_name
    file_path.write_bytes(b"dummy mp3 data")

    item = DownloadItem(
        id=test_id,
        url="https://www.youtube.com/watch?v=mock123",
        status=DownloadStatus.COMPLETED,
        title="Milo J - Solifican12 (Video Oficial)",
        filename=file_name,
    )
    queue_service._items[test_id] = item

    try:
        response = client.get(f"/api/downloads/{test_id}/file")
        assert response.status_code == 200
        cd = response.headers.get("content-disposition", "")
        # Prefix must NOT be present
        assert "testhex012_" not in cd
        # "(Video Oficial)" must NOT be present
        assert "Video Oficial" not in cd
        # Clean title must be present
        assert 'filename="Milo J - Solifican12.mp3"' in cd
        assert "filename*=UTF-8''Milo%20J%20-%20Solifican12.mp3" in cd
    finally:
        queue_service._items.pop(test_id, None)
        file_path.unlink(missing_ok=True)
