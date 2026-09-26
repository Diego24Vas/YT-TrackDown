import asyncio
import logging
from datetime import datetime
from typing import Optional, Callable
from backend.app.core.config import settings
from backend.app.domain.models import DownloadItem, DownloadStatus, DownloadProgress, DownloadFormat
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

    def _resolve_error_message(self, err: Exception) -> str:
        """Formats common yt-dlp error exceptions into friendly messages."""
        err_str = str(err)
        if "Sign in to confirm your age" in err_str or "confirm your age" in err_str:
            if self.adapter.has_cookies():
                return "Restricción de edad (+18): Las cookies actuales no tienen acceso o caducaron. Actualiza cookies.txt."
            else:
                return "Restricción de edad (+18): Requiere iniciar sesión. Configura tus cookies de YouTube en la barra superior."
        elif "Sign in to confirm you're not a bot" in err_str or ("bot" in err_str.lower() and "confirm" in err_str.lower()):
            return "YouTube solicitó verificación antibot. Configura cookies de YouTube en la barra superior para continuar."
        elif "Video unavailable" in err_str:
            return "El video no está disponible (privado, eliminado o bloqueado en tu región)."
        elif "Private video" in err_str:
            return "Este video es privado. Requiere cookies de una cuenta con permiso de visualización."
        elif "members-only" in err_str.lower() or "join this channel" in err_str.lower():
            return "Este video es exclusivo para miembros del canal de YouTube."
        return f"Error al procesar: {err_str[:130]}"

    async def process_audio_download(
        self,
        item: DownloadItem,
        loop: asyncio.AbstractEventLoop,
        notify_progress: Callable[[str, dict], None],
        notify_status: Callable[[str, DownloadStatus], None],
    ) -> DownloadItem:
        """Executes MP3 audio download and conversion in a background thread."""
        try:
            item.status = DownloadStatus.DOWNLOADING
            notify_status(item.id, DownloadStatus.DOWNLOADING)

            def sync_progress(data: dict):
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
            logger.error(f"Error downloading audio {item.url}: {e}", exc_info=True)
            item.status = DownloadStatus.ERROR
            item.error_message = self._resolve_error_message(e)
            notify_status(item.id, DownloadStatus.ERROR)
            return item

    async def process_video_download(
        self,
        item: DownloadItem,
        loop: asyncio.AbstractEventLoop,
        notify_progress: Callable[[str, dict], None],
        notify_status: Callable[[str, DownloadStatus], None],
    ) -> DownloadItem:
        """Executes MP4 video download and muxing in a background thread."""
        try:
            item.status = DownloadStatus.DOWNLOADING
            notify_status(item.id, DownloadStatus.DOWNLOADING)

            def sync_progress(data: dict):
                loop.call_soon_threadsafe(notify_progress, item.id, data)

            def sync_converting():
                loop.call_soon_threadsafe(notify_status, item.id, DownloadStatus.CONVERTING)

            result = await asyncio.to_thread(
                self.adapter.download_video,
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
            logger.error(f"Error downloading video {item.url}: {e}", exc_info=True)
            item.status = DownloadStatus.ERROR
            item.error_message = self._resolve_error_message(e)
            notify_status(item.id, DownloadStatus.ERROR)
            return item

    async def process_download(
        self,
        item: DownloadItem,
        loop: asyncio.AbstractEventLoop,
        notify_progress: Callable[[str, dict], None],
        notify_status: Callable[[str, DownloadStatus], None],
    ) -> DownloadItem:
        """
        Dispatches download to dedicated audio or video processor without mixing logic.
        """
        is_video = (item.format == DownloadFormat.MP4) or str(item.format).lower() in ("mp4", "downloadformat.mp4")
        if is_video:
            return await self.process_video_download(item, loop, notify_progress, notify_status)
        else:
            return await self.process_audio_download(item, loop, notify_progress, notify_status)

downloader_service = DownloaderService()
