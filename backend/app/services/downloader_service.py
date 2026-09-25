import asyncio
import logging
from datetime import datetime
from typing import Optional, Callable
from backend.app.core.config import settings
from backend.app.domain.models import DownloadItem, DownloadStatus, DownloadProgress
from backend.app.adapters.ytdlp_adapter import ytdlp_adapter
from backend.app.adapters.storage_adapter import storage_adapter

logger = logging.getLogger(__name__)

class DownloaderService:
    def __init__(self):
        self.adapter = ytdlp_adapter
        self.storage = storage_adapter

    async def fetch_item_metadata(self, item: DownloadItem, on_update: Optional[Callable[[DownloadItem], None]] = None):
        """Fetches metadata asynchronously in thread pool."""
        try:
            item.status = DownloadStatus.FETCHING_INFO
            if on_update:
                on_update(item)

            info = await asyncio.to_thread(self.adapter.extract_info, item.url)
            item.title = info.get("title")
            item.artist = info.get("artist")
            item.duration = info.get("duration")
            item.duration_str = info.get("duration_str")
            item.thumbnail = info.get("thumbnail")
            
            if on_update:
                on_update(item)
        except Exception as e:
            logger.warning(f"Could not pre-fetch metadata for {item.url}: {e}")
            # Non-fatal: title will be retrieved during download

    async def process_download(
        self,
        item: DownloadItem,
        loop: asyncio.AbstractEventLoop,
        notify_progress: Callable[[str, dict], None],
        notify_status: Callable[[str, DownloadStatus], None],
    ) -> DownloadItem:
        """
        Executes download and conversion in a background thread,
        dispatching progress updates back to the event loop safely.
        """
        try:
            item.status = DownloadStatus.DOWNLOADING
            notify_status(item.id, DownloadStatus.DOWNLOADING)

            def sync_progress(data: dict):
                # Thread-safe dispatch to main event loop
                loop.call_soon_threadsafe(notify_progress, item.id, data)

            def sync_converting():
                loop.call_soon_threadsafe(notify_status, item.id, DownloadStatus.CONVERTING)

            result = await asyncio.to_thread(
                self.adapter.download_audio,
                url=item.url,
                output_dir=settings.DOWNLOADS_DIR,
                item_id=item.id,
                quality=item.quality,
                on_progress=sync_progress,
                on_converting=sync_converting,
            )

            item.status = DownloadStatus.COMPLETED
            item.filename = result["filename"]
            item.file_size = result["file_size"]
            item.file_size_str = result["file_size_str"]
            item.title = result["title"]
            item.artist = result["artist"]
            item.duration = result["duration"]
            item.duration_str = result["duration_str"]
            if result.get("thumbnail"):
                item.thumbnail = result["thumbnail"]
            
            item.completed_at = datetime.now().isoformat()
            item.progress.percentage = 100.0
            item.progress.speed_str = ""
            item.progress.eta_str = ""

            notify_status(item.id, DownloadStatus.COMPLETED)
            return item

        except Exception as e:
            logger.error(f"Error downloading {item.url}: {e}", exc_info=True)
            item.status = DownloadStatus.ERROR
            # Human readable message
            err_str = str(e)
            if "Video unavailable" in err_str:
                item.error_message = "El video no está disponible (privado o eliminado)."
            elif "Sign in to confirm you're not a bot" in err_str:
                item.error_message = "YouTube solicitó verificación antibot para este video."
            elif "Private video" in err_str:
                item.error_message = "Este video es privado."
            else:
                item.error_message = f"Error al procesar: {err_str[:120]}"

            notify_status(item.id, DownloadStatus.ERROR)
            return item

downloader_service = DownloaderService()
