import asyncio
import logging
from datetime import datetime
from typing import Dict, List, Optional, Set, AsyncGenerator, Any
from backend.app.core.config import settings
from backend.app.domain.models import (
    DownloadItem,
    DownloadStatus,
    DownloadProgress,
    DownloadFormat,
    SystemStats,
)
from backend.app.services.downloader_service import downloader_service
from backend.app.adapters.storage_adapter import storage_adapter
from backend.app.adapters.ytdlp_adapter import ytdlp_adapter

logger = logging.getLogger(__name__)

class QueueService:
    def __init__(self):
        self._items: Dict[str, DownloadItem] = {}
        self._queue: Optional[asyncio.Queue[str]] = None
        self._subscribers: Set[asyncio.Queue] = set()
        self._workers: List[asyncio.Task] = []
        self._cleanup_task: Optional[asyncio.Task] = None
        self._running: bool = False

    @property
    def queue(self) -> asyncio.Queue[str]:
        if self._queue is None:
            self._queue = asyncio.Queue()
        return self._queue

    def start_workers(self, loop: asyncio.AbstractEventLoop):
        """Starts asynchronous worker pool and file auto-cleaner for background processing."""
        if self._running:
            return
        self._queue = asyncio.Queue()
        self._running = True
        for i in range(settings.MAX_CONCURRENT_DOWNLOADS):
            worker_task = loop.create_task(self._worker_loop(i, loop))
            self._workers.append(worker_task)
        
        # Start background task to automatically clean old files after retention period
        self._cleanup_task = loop.create_task(self._cleanup_loop())
        logger.info(
            f"Started {len(self._workers)} background download workers and file auto-cleaner "
            f"(retention: {settings.FILE_RETENTION_MINUTES} min, check interval: {settings.CLEANUP_CHECK_INTERVAL_SECONDS}s)."
        )

    async def stop_workers(self):
        """Cleanly cancels all worker tasks and cleanup task."""
        self._running = False
        for task in self._workers:
            task.cancel()
        if self._cleanup_task:
            self._cleanup_task.cancel()

        tasks_to_wait = list(self._workers)
        if self._cleanup_task:
            tasks_to_wait.append(self._cleanup_task)

        await asyncio.gather(*tasks_to_wait, return_exceptions=True)
        self._workers.clear()
        self._cleanup_task = None
        self._queue = None
        logger.info("All download workers and cleanup tasks stopped.")

    async def _cleanup_loop(self):
        """Periodically checks and deletes files older than retention period."""
        logger.info(
            f"File auto-cleanup loop running (retention: {settings.FILE_RETENTION_MINUTES} min, "
            f"interval: {settings.CLEANUP_CHECK_INTERVAL_SECONDS}s)."
        )
        # Perform an immediate cleanup pass on startup
        try:
            await self.perform_cleanup()
        except Exception as e:
            logger.error(f"Error during initial file cleanup pass: {e}", exc_info=True)

        while self._running:
            try:
                await asyncio.sleep(settings.CLEANUP_CHECK_INTERVAL_SECONDS)
                if not self._running:
                    break
                await self.perform_cleanup()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in file auto-cleanup loop: {e}", exc_info=True)

    async def perform_cleanup(self):
        """Executes one pass of file and item expiration."""
        retention_seconds = settings.FILE_RETENTION_SECONDS

        # 1. Protect active downloads from being cleaned
        active_ids = {
            item.id for item in self._items.values()
            if item.status in (
                DownloadStatus.QUEUED,
                DownloadStatus.FETCHING_INFO,
                DownloadStatus.DOWNLOADING,
                DownloadStatus.CONVERTING,
            )
        }

        # 2. Delete files on disk older than retention threshold (runs in thread pool)
        deleted_files = await asyncio.to_thread(
            storage_adapter.clean_old_files,
            max_age_seconds=retention_seconds,
            active_ids=active_ids,
        )
        deleted_filenames_set = set(deleted_files)

        # 3. Synchronize status of in-memory items
        now = datetime.now()
        for item in list(self._items.values()):
            if item.status == DownloadStatus.COMPLETED:
                file_is_gone = (
                    (item.filename and item.filename in deleted_filenames_set) or
                    (item.filename and not storage_adapter.file_exists(item.filename))
                )

                is_expired_by_time = False
                if item.completed_at:
                    try:
                        completed_dt = datetime.fromisoformat(item.completed_at)
                        if (now - completed_dt).total_seconds() >= retention_seconds:
                            is_expired_by_time = True
                    except Exception:
                        pass

                if file_is_gone or is_expired_by_time:
                    # Make sure physical file is deleted if it still existed
                    if item.filename and storage_adapter.file_exists(item.filename):
                        storage_adapter.delete_file(item.filename)

                    item.status = DownloadStatus.EXPIRED
                    self.broadcast_event("item_updated", item.model_dump())
                    logger.info(
                        f"Item {item.id} ('{item.title}') marked as EXPIRED "
                        f"and file deleted after {settings.FILE_RETENTION_MINUTES} min."
                    )

    async def _worker_loop(self, worker_id: int, loop: asyncio.AbstractEventLoop):
        """Worker that continuously picks items from queue and downloads them."""
        logger.info(f"Worker-{worker_id} started.")
        while self._running:
            try:
                item_id = await self.queue.get()
                item = self._items.get(item_id)
                if not item:
                    self.queue.task_done()
                    continue

                if item.status in (DownloadStatus.CANCELLED, DownloadStatus.COMPLETED):
                    self.queue.task_done()
                    continue

                # Pre-fetch metadata if not done yet
                if not item.title:
                    await downloader_service.fetch_item_metadata(
                        item,
                        on_update=lambda itm: self.broadcast_event("item_updated", itm.model_dump())
                    )

                # Process download
                await downloader_service.process_download(
                    item=item,
                    loop=loop,
                    notify_progress=self.on_item_progress,
                    notify_status=self.on_item_status,
                )

                self.queue.task_done()

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Worker-{worker_id} unexpected error: {e}", exc_info=True)
                await asyncio.sleep(1)

    def on_item_progress(self, item_id: str, progress_data: dict):
        """Updates progress of an item and broadcasts update."""
        item = self._items.get(item_id)
        if item and item.status == DownloadStatus.DOWNLOADING:
            item.progress.percentage = progress_data.get("percentage", 0.0)
            item.progress.downloaded_bytes = progress_data.get("downloaded_bytes", 0)
            item.progress.total_bytes = progress_data.get("total_bytes", 0)
            item.progress.speed_str = progress_data.get("speed_str", "")
            item.progress.eta_str = progress_data.get("eta_str", "")
            self.broadcast_event("item_progress", {
                "id": item_id,
                "progress": item.progress.model_dump(),
                "status": item.status.value,
            })

    def on_item_status(self, item_id: str, status: DownloadStatus):
        """Updates status of an item and broadcasts update."""
        item = self._items.get(item_id)
        if item:
            item.status = status
            self.broadcast_event("item_updated", item.model_dump())

    async def add_items(
        self,
        urls: List[str],
        quality: str = "192",
        format: DownloadFormat = DownloadFormat.MP3,
        metadata_items: Optional[List[Any]] = None,
    ) -> List[DownloadItem]:
        """Validates and enqueues a batch of URLs, automatically expanding any playlists concurrently."""
        created_items: List[DownloadItem] = []
        handled_urls = set()

        # 1. Process items with pre-resolved metadata (instantaneous)
        if metadata_items:
            for meta in metadata_items:
                v_url = (meta.url if hasattr(meta, "url") else meta.get("url", "")).strip()
                if not v_url or not (v_url.startswith("http://") or v_url.startswith("https://")):
                    continue
                handled_urls.add(v_url)
                item = DownloadItem(
                    url=v_url,
                    quality=quality,
                    format=format,
                    status=DownloadStatus.QUEUED,
                    title=meta.title if hasattr(meta, "title") else meta.get("title"),
                    artist=meta.artist if hasattr(meta, "artist") else meta.get("artist"),
                    duration=meta.duration if hasattr(meta, "duration") else meta.get("duration"),
                    duration_str=meta.duration_str if hasattr(meta, "duration_str") else meta.get("duration_str"),
                    thumbnail=meta.thumbnail if hasattr(meta, "thumbnail") else meta.get("thumbnail"),
                )
                self._items[item.id] = item
                self.queue.put_nowait(item.id)
                created_items.append(item)
                self.broadcast_event("item_added", item.model_dump())

        # 2. Process any raw URLs that still need expansion (concurrently)
        remaining_urls = [u for u in (urls or []) if u.strip() not in handled_urls]
        if remaining_urls:
            async def process_raw_url(raw_url: str) -> List[DownloadItem]:
                url = raw_url.strip()
                if not url or not (url.startswith("http://") or url.startswith("https://")):
                    return []
                try:
                    expanded = await asyncio.to_thread(ytdlp_adapter.expand_url, url)
                except Exception as e:
                    logger.warning(f"Error expanding {url}: {e}")
                    expanded = [{"url": url}]

                items: List[DownloadItem] = []
                for entry in expanded:
                    v_url = entry.get("url")
                    if not v_url:
                        continue
                    item = DownloadItem(
                        url=v_url,
                        quality=quality,
                        format=format,
                        status=DownloadStatus.QUEUED,
                        title=entry.get("title"),
                        artist=entry.get("artist"),
                        duration=entry.get("duration"),
                        duration_str=entry.get("duration_str"),
                        thumbnail=entry.get("thumbnail"),
                    )
                    self._items[item.id] = item
                    self.queue.put_nowait(item.id)
                    items.append(item)
                    self.broadcast_event("item_added", item.model_dump())
                return items

            results = await asyncio.gather(*(process_raw_url(u) for u in remaining_urls))
            for sublist in results:
                created_items.extend(sublist)

        return created_items

    def retry_item(self, item_id: str) -> Optional[DownloadItem]:
        """Re-enqueues a failed, cancelled, or expired item."""
        item = self._items.get(item_id)
        if item:
            item.status = DownloadStatus.QUEUED
            item.error_message = None
            item.progress = DownloadProgress()
            item.filename = None
            item.completed_at = None
            self.queue.put_nowait(item.id)
            self.broadcast_event("item_updated", item.model_dump())
            return item
        return None

    def get_item(self, item_id: str) -> Optional[DownloadItem]:
        return self._items.get(item_id)

    def get_all_items(self) -> List[DownloadItem]:
        # Return sorted by creation time (most recent first or insertion order)
        return list(self._items.values())

    def remove_item(self, item_id: str) -> bool:
        """Removes an item and its downloaded file if present."""
        item = self._items.pop(item_id, None)
        if item:
            if item.filename:
                storage_adapter.delete_file(item.filename)
            self.broadcast_event("item_removed", {"id": item_id})
            return True
        return False

    def clear_completed(self) -> int:
        """Clears all completed and expired items from list."""
        to_remove = [
            k for k, v in self._items.items()
            if v.status in (DownloadStatus.COMPLETED, DownloadStatus.EXPIRED)
        ]
        for k in to_remove:
            self.remove_item(k)
        return len(to_remove)

    def get_stats(self) -> SystemStats:
        items = list(self._items.values())
        return SystemStats(
            total_items=len(items),
            completed=sum(1 for i in items if i.status == DownloadStatus.COMPLETED),
            in_progress=sum(1 for i in items if i.status in (DownloadStatus.DOWNLOADING, DownloadStatus.CONVERTING, DownloadStatus.FETCHING_INFO)),
            queued=sum(1 for i in items if i.status == DownloadStatus.QUEUED),
            errors=sum(1 for i in items if i.status == DownloadStatus.ERROR),
            expired=sum(1 for i in items if i.status == DownloadStatus.EXPIRED),
        )

    def broadcast_event(self, event_type: str, data: dict):
        """Sends SSE message to all connected clients."""
        payload = {"event": event_type, "data": data}
        dead_subs = set()
        for q in self._subscribers:
            try:
                q.put_nowait(payload)
            except asyncio.QueueFull:
                dead_subs.add(q)
            except Exception:
                dead_subs.add(q)
        for dead in dead_subs:
            self._subscribers.discard(dead)

    async def subscribe(self) -> AsyncGenerator[dict, None]:
        """Generator that yields events for a single SSE client connection."""
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        self._subscribers.add(queue)
        try:
            # Yield initial sync event with current state
            initial_data = [item.model_dump() for item in self._items.values()]
            yield {
                "event": "init",
                "data": {"items": initial_data, "stats": self.get_stats().model_dump()}
            }
            while True:
                msg = await queue.get()
                yield msg
        finally:
            self._subscribers.discard(queue)

queue_service = QueueService()
