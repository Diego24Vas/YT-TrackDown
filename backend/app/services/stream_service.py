import asyncio
import logging
from datetime import datetime
from typing import Dict, List, Optional
from pathlib import Path

from backend.app.core.config import settings
from backend.app.domain.stream_models import (
    StreamDownloadItem,
    StreamDownloadRequest,
    StreamProbeRequest,
    StreamProbeResponse,
    StreamStatus,
    StreamFormat,
)
from backend.app.adapters.stream_adapter import stream_adapter
from backend.app.adapters.storage_adapter import storage_adapter

logger = logging.getLogger(__name__)

class StreamService:
    def __init__(self):
        self._items: Dict[str, StreamDownloadItem] = {}
        self._tasks: Dict[str, asyncio.Task] = {}

    async def probe(self, request: StreamProbeRequest) -> StreamProbeResponse:
        """Asynchronously probes stream headers and access permissions."""
        return await asyncio.to_thread(
            stream_adapter.probe_stream,
            url=request.url,
            referer=request.referer,
            user_agent=request.user_agent,
            origin=request.origin,
            custom_headers=request.custom_headers,
            cookies=request.cookies,
        )

    def get_item(self, item_id: str) -> Optional[StreamDownloadItem]:
        return self._items.get(item_id)

    def get_all_items(self) -> List[StreamDownloadItem]:
        return list(self._items.values())

    async def start_download(self, request: StreamDownloadRequest) -> StreamDownloadItem:
        """Enqueues and starts stream download with custom HTTP headers."""
        item = StreamDownloadItem(
            url=request.url.strip(),
            referer=request.referer.strip() if request.referer else None,
            user_agent=request.user_agent.strip() if request.user_agent else None,
            custom_title=request.custom_title.strip() if request.custom_title else None,
            format=request.format,
            engine=request.engine or "yt-dlp",
            status=StreamStatus.QUEUED,
            title=request.custom_title.strip() if request.custom_title else "Stream Video",
        )
        self._items[item.id] = item

        loop = asyncio.get_running_loop()
        task = loop.create_task(self._run_download_task(item, request, loop))
        self._tasks[item.id] = task

        return item

    async def _run_download_task(
        self,
        item: StreamDownloadItem,
        req: StreamDownloadRequest,
        loop: asyncio.AbstractEventLoop,
    ):
        try:
            item.status = StreamStatus.DOWNLOADING

            def on_progress(data: dict):
                item.progress.percentage = data.get("percentage", 0.0)
                item.progress.downloaded_bytes = data.get("downloaded_bytes", 0)
                item.progress.total_bytes = data.get("total_bytes", 0)
                item.progress.speed_str = data.get("speed_str", "")
                item.progress.eta_str = data.get("eta_str", "")

            def on_converting():
                item.status = StreamStatus.CONVERTING

            result = await asyncio.to_thread(
                stream_adapter.download_with_ytdlp,
                url=item.url,
                output_dir=settings.DOWNLOADS_DIR,
                item_id=item.id,
                target_format=item.format,
                custom_title=item.custom_title,
                referer=req.referer,
                user_agent=req.user_agent,
                origin=req.origin,
                custom_headers=req.custom_headers,
                cookies=req.cookies,
                on_progress=on_progress,
                on_converting=on_converting,
            )

            item.status = StreamStatus.COMPLETED
            item.filename = result["filename"]
            item.file_path = result["file_path"]
            item.file_size = result["file_size"]
            item.file_size_str = result["file_size_str"]
            item.title = result.get("title") or item.title
            item.completed_at = datetime.now().isoformat()
            item.progress.percentage = 100.0
            item.progress.speed_str = ""
            item.progress.eta_str = ""

        except Exception as e:
            logger.error(f"Stream download failed for {item.url}: {e}", exc_info=True)
            item.status = StreamStatus.ERROR
            err_str = str(e)
            if "HTTP Error 403" in err_str or "Forbidden" in err_str:
                item.error_message = (
                    "HTTP 403 Forbidden: Servidor bloqueó la descarga. "
                    "Verifica que el Referer coincida con la web original del video."
                )
            elif "HTTP Error 404" in err_str or "Not Found" in err_str:
                item.error_message = "HTTP 404 Not Found: El archivo .m3u8 no existe o expiró."
            else:
                item.error_message = f"Error al procesar: {err_str[:150]}"
        finally:
            self._tasks.pop(item.id, None)

    def remove_item(self, item_id: str) -> bool:
        """Cancels any running task and removes file and item."""
        task = self._tasks.pop(item_id, None)
        if task and not task.done():
            task.cancel()

        item = self._items.pop(item_id, None)
        if not item:
            return False

        if item.filename:
            storage_adapter.delete_file(item.filename)

        return True

    def clear_completed(self) -> int:
        """Removes completed or errored stream items."""
        to_remove = [
            item_id for item_id, it in self._items.items()
            if it.status in (StreamStatus.COMPLETED, StreamStatus.ERROR, StreamStatus.CANCELLED)
        ]
        count = 0
        for item_id in to_remove:
            self._items.pop(item_id, None)
            count += 1
        return count

stream_service = StreamService()
