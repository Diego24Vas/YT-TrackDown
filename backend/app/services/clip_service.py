import asyncio
import logging
from datetime import datetime
from typing import Dict, List, Optional
from pathlib import Path

from backend.app.core.config import settings
from backend.app.domain.clip_models import (
    ClipDownloadItem,
    ClipDownloadRequest,
    ClipProbeRequest,
    ClipProbeResponse,
    ClipStatus,
    ClipFormat,
)
from backend.app.adapters.clip_adapter import clip_adapter
from backend.app.adapters.storage_adapter import storage_adapter

logger = logging.getLogger(__name__)

class ClipService:
    def __init__(self):
        self._items: Dict[str, ClipDownloadItem] = {}
        self._tasks: Dict[str, asyncio.Task] = {}

    async def probe(self, request: ClipProbeRequest) -> ClipProbeResponse:
        """Inspects media URL asynchronously to retrieve title, duration, and thumbnail."""
        try:
            info = await asyncio.to_thread(clip_adapter.probe_video, request.url.strip())
            return ClipProbeResponse(
                success=True,
                title=info.get("title"),
                artist=info.get("artist"),
                duration=info.get("duration"),
                duration_str=info.get("duration_str"),
                thumbnail=info.get("thumbnail"),
            )
        except Exception as e:
            logger.warning(f"Clip probe failed for {request.url}: {e}")
            err_str = str(e)
            if "Video unavailable" in err_str:
                msg = "El video no está disponible (privado, eliminado o bloqueado)."
            elif "confirm your age" in err_str.lower():
                msg = "Restricción de edad (+18): Requiere cookies de YouTube configuradas."
            elif "bot" in err_str.lower() and "confirm" in err_str.lower():
                msg = "YouTube solicitó verificación antibot. Configura cookies de YouTube."
            else:
                msg = f"No se pudo obtener información del video: {err_str[:120]}"
            return ClipProbeResponse(
                success=False,
                error_message=msg,
            )

    def get_item(self, item_id: str) -> Optional[ClipDownloadItem]:
        return self._items.get(item_id)

    def get_all_items(self) -> List[ClipDownloadItem]:
        return list(self._items.values())

    async def start_download(self, request: ClipDownloadRequest) -> ClipDownloadItem:
        """Enqueues and starts a clip download task in background."""
        st = clip_adapter.parse_timestamp(request.start_time)
        et = clip_adapter.parse_timestamp(request.end_time) if request.end_time is not None else None
        if et is not None and et <= st:
            et = None

        st_str = clip_adapter.format_timestamp(st)
        et_str = clip_adapter.format_timestamp(et) if et is not None else "Fin"
        clip_dur_str = storage_adapter.format_duration(int(round(et - st))) if et is not None else None

        item = ClipDownloadItem(
            url=request.url.strip(),
            start_time=st,
            end_time=et,
            start_time_str=st_str,
            end_time_str=et_str,
            clip_duration_str=clip_dur_str,
            format=request.format,
            quality=request.quality or "1080",
            custom_title=request.custom_title.strip() if request.custom_title else None,
            status=ClipStatus.QUEUED,
            title=request.custom_title.strip() if request.custom_title else f"Clip [{st_str} - {et_str}]",
        )
        self._items[item.id] = item

        loop = asyncio.get_running_loop()
        task = loop.create_task(self._run_download_task(item, request, loop))
        self._tasks[item.id] = task

        return item

    async def _run_download_task(
        self,
        item: ClipDownloadItem,
        req: ClipDownloadRequest,
        loop: asyncio.AbstractEventLoop,
    ):
        try:
            item.status = ClipStatus.DOWNLOADING
            item.progress.percentage = 0.0
            item.progress.speed_str = "Analizando stream..."

            done_event = asyncio.Event()
            prog_file = settings.DOWNLOADS_DIR / f"{item.id}_ffmpeg_progress.txt"
            clip_dur = max(0.5, (item.end_time or 0.0) - (item.start_time or 0.0))

            def on_progress(data: dict):
                p = data.get("percentage", 0.0)
                if p > 0:
                    item.progress.percentage = min(98.0, max(item.progress.percentage, p))
                if data.get("downloaded_bytes"):
                    item.progress.downloaded_bytes = data["downloaded_bytes"]
                if data.get("total_bytes"):
                    item.progress.total_bytes = data["total_bytes"]
                if data.get("speed_str"):
                    item.progress.speed_str = data["speed_str"]
                if data.get("eta_str"):
                    item.progress.eta_str = data["eta_str"]

            def on_converting():
                item.status = ClipStatus.CONVERTING
                item.progress.speed_str = "Ensamblando pistas..."

            async def _monitor_progress():
                start_t = loop.time()
                while not done_event.is_set():
                    await asyncio.sleep(0.12)
                    if done_event.is_set():
                        break

                    # 1. Read real ffmpeg progress if available
                    if prog_file.exists():
                        try:
                            content = prog_file.read_text(encoding="utf-8", errors="ignore")
                            parsed = {}
                            for line in content.splitlines():
                                if "=" in line:
                                    k, v = line.split("=", 1)
                                    parsed[k.strip()] = v.strip()

                            out_us_str = parsed.get("out_time_us", "")
                            if out_us_str.isdigit():
                                out_us = int(out_us_str)
                                if out_us > 0 and clip_dur > 0:
                                    proc_secs = out_us / 1_000_000.0
                                    real_pct = min(98.0, (proc_secs / clip_dur) * 100.0)
                                    item.progress.percentage = max(item.progress.percentage, round(real_pct, 1))

                                    speed_val = parsed.get("speed", "").strip()
                                    if speed_val and speed_val != "N/A":
                                        item.progress.speed_str = speed_val
                                        try:
                                            speed_num = float(speed_val.rstrip("x"))
                                            if speed_num > 0.05:
                                                rem_s = max(0, int((clip_dur - proc_secs) / speed_num))
                                                item.progress.eta_str = storage_adapter.format_duration(rem_s)
                                        except Exception:
                                            pass

                            size_str = parsed.get("total_size", "")
                            if size_str.isdigit() and int(size_str) > 0:
                                item.progress.downloaded_bytes = int(size_str)

                            if parsed.get("progress") == "end":
                                item.status = ClipStatus.CONVERTING
                                item.progress.speed_str = "Ensamblando archivo..."
                        except Exception:
                            pass

                    # 2. Track disk activity
                    disk_bytes = 0
                    for p in settings.DOWNLOADS_DIR.glob(f"{item.id}_*"):
                        if p.name.endswith("_ffmpeg_progress.txt"):
                            continue
                        try:
                            disk_bytes += p.stat().st_size
                        except Exception:
                            pass

                    if disk_bytes > 0:
                        item.progress.downloaded_bytes = max(item.progress.downloaded_bytes, disk_bytes)
                        if not item.progress.speed_str or item.progress.speed_str == "Analizando stream...":
                            elapsed = max(0.3, loop.time() - start_t)
                            cur_speed = disk_bytes / elapsed
                            item.progress.speed_str = f"{storage_adapter.format_bytes(cur_speed)}/s"

            monitor_task = loop.create_task(_monitor_progress())

            try:
                result = await asyncio.to_thread(
                    clip_adapter.download_clip,
                    url=item.url,
                    output_dir=settings.DOWNLOADS_DIR,
                    item_id=item.id,
                    target_format=item.format,
                    quality=item.quality,
                    start_time=item.start_time,
                    end_time=item.end_time,
                    custom_title=item.custom_title,
                    on_progress=on_progress,
                    on_converting=on_converting,
                )
            finally:
                done_event.set()
                monitor_task.cancel()

            item.status = ClipStatus.COMPLETED
            item.filename = result["filename"]
            item.file_path = result["file_path"]
            item.file_size = result["file_size"]
            item.file_size_str = result["file_size_str"]
            item.title = result.get("title") or item.title
            item.artist = result.get("artist") or item.artist
            item.thumbnail = result.get("thumbnail") or item.thumbnail
            if result.get("duration_str"):
                item.clip_duration_str = result["duration_str"]
            item.completed_at = datetime.now().isoformat()
            item.progress.percentage = 100.0
            item.progress.speed_str = ""
            item.progress.eta_str = ""

        except Exception as e:
            logger.error(f"Clip download failed for {item.url}: {e}", exc_info=True)
            item.status = ClipStatus.ERROR
            err_str = str(e)
            if "Sign in to confirm your age" in err_str or "confirm your age" in err_str.lower():
                item.error_message = "Restricción de edad (+18): Requiere cookies de YouTube en la barra superior."
            elif "bot" in err_str.lower() and "confirm" in err_str.lower():
                item.error_message = "Verificación antibot requerida. Configura cookies de YouTube en la barra superior."
            elif "Video unavailable" in err_str:
                item.error_message = "El video no está disponible (privado o eliminado)."
            else:
                item.error_message = f"Error al generar clip: {err_str[:140]}"
        finally:
            self._tasks.pop(item.id, None)

    def remove_item(self, item_id: str) -> bool:
        """Cancels any running task and removes physical file and memory item."""
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
        """Removes completed or errored clip items from history."""
        to_remove = [
            item_id for item_id, it in self._items.items()
            if it.status in (ClipStatus.COMPLETED, ClipStatus.ERROR, ClipStatus.CANCELLED)
        ]
        count = 0
        for item_id in to_remove:
            self._items.pop(item_id, None)
            count += 1
        return count

clip_service = ClipService()

