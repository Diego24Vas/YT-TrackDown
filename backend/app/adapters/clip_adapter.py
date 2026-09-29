import os
import re
import shutil
import logging
from typing import Callable, Optional, Dict, Any
from pathlib import Path
from datetime import datetime
import yt_dlp
from yt_dlp.utils import download_range_func

try:
    from yt_dlp.networking.impersonate import ImpersonateTarget
    IMPERSONATE_CHROME = ImpersonateTarget.from_str("chrome")
except Exception:
    IMPERSONATE_CHROME = None

from backend.app.core.config import settings
from backend.app.adapters.storage_adapter import storage_adapter
from backend.app.domain.clip_models import ClipFormat

logger = logging.getLogger(__name__)

class ClipAdapter:
    def __init__(self):
        self.ffmpeg_location = settings.FFMPEG_LOCATION
        self.node_path = settings.NODE_PATH
        self.deno_path = settings.DENO_PATH

    @staticmethod
    def parse_timestamp(val: Any) -> float:
        """Parses MM:SS, HH:MM:SS, or numeric seconds into float seconds."""
        if val is None:
            return 0.0
        if isinstance(val, (int, float)):
            return max(0.0, float(val))
        s = str(val).strip()
        if not s:
            return 0.0
        if ":" in s:
            parts = [float(p) for p in s.split(":") if p.strip()]
            if len(parts) == 1:
                return parts[0]
            elif len(parts) == 2:
                return parts[0] * 60.0 + parts[1]
            elif len(parts) >= 3:
                return parts[0] * 3600.0 + parts[1] * 60.0 + parts[2]
        try:
            return max(0.0, float(s))
        except ValueError:
            return 0.0

    @staticmethod
    def format_timestamp(seconds: Optional[float]) -> str:
        """Formats seconds into MM:SS or HH:MM:SS format."""
        if seconds is None or seconds <= 0:
            return "00:00"
        tot = int(round(seconds))
        m, s = divmod(tot, 60)
        h, m = divmod(m, 60)
        if h > 0:
            return f"{h:02d}:{m:02d}:{s:02d}"
        return f"{m:02d}:{s:02d}"

    def _get_base_opts(self) -> Dict[str, Any]:
        """Base options for yt_dlp extraction and downloading."""
        opts: Dict[str, Any] = {
            "quiet": True,
            "no_warnings": True,
            "ffmpeg_location": self.ffmpeg_location,
            "remote_components": ["ejs:github"],
            "noplaylist": True,
            "updatetime": False,
            "http_chunk_size": 10485760,
            "socket_timeout": 30,
            "retries": 10,
            "fragment_retries": 10,
            "file_access_retries": 5,
        }
        deno_bin = self.deno_path or shutil.which("deno")
        if deno_bin and os.path.exists(str(deno_bin)):
            opts["js_runtimes"] = {"deno": {"path": str(deno_bin)}}

        active_cookies = settings.get_active_cookies_file()
        if active_cookies:
            opts["cookiefile"] = str(active_cookies)

        if IMPERSONATE_CHROME:
            opts["impersonate"] = IMPERSONATE_CHROME

        return opts

    def probe_video(self, url: str) -> Dict[str, Any]:
        """Inspects media URL without downloading to retrieve duration, thumbnail, and title."""
        opts = self._get_base_opts()
        opts["simulate"] = True

        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
            if not info:
                raise ValueError("No se pudo obtener información del enlace proporcionado.")

            if "entries" in info:
                entries = list(info["entries"])
                if entries:
                    info = entries[0]
                else:
                    raise ValueError("Lista de reproducción vacía.")

            title = info.get("title") or "Video"
            artist = info.get("artist") or info.get("uploader") or info.get("channel") or ""
            duration = info.get("duration") or 0
            thumbnail = info.get("thumbnail") or None

            return {
                "id": info.get("id"),
                "title": title,
                "artist": artist,
                "duration": duration,
                "duration_str": storage_adapter.format_duration(duration),
                "thumbnail": thumbnail,
            }

    def download_clip(
        self,
        url: str,
        output_dir: Path,
        item_id: str,
        target_format: ClipFormat,
        quality: str = "1080",
        start_time: float = 0.0,
        end_time: Optional[float] = None,
        custom_title: Optional[str] = None,
        on_progress: Optional[Callable[[Dict[str, Any]], None]] = None,
        on_converting: Optional[Callable[[], None]] = None,
    ) -> Dict[str, Any]:
        """
        Downloads a specific time range of video/audio directly using stream keyframe cuts.
        """
        output_dir.mkdir(parents=True, exist_ok=True)

        st = max(0.0, float(start_time))
        et = float(end_time) if (end_time is not None and float(end_time) > st) else float("inf")

        # Filename prefix with item_id for clean isolation
        out_template = str(output_dir / f"{item_id}_%(title).100B.%(ext)s")

        def progress_hook(d: Dict[str, Any]):
            if d.get("status") == "downloading" and on_progress:
                total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
                downloaded = d.get("downloaded_bytes") or 0
                percentage = (downloaded / total * 100.0) if total > 0 else 0.0

                speed = d.get("speed")
                speed_str = f"{storage_adapter.format_bytes(speed)}/s" if speed else ""

                eta = d.get("eta")
                eta_str = storage_adapter.format_duration(eta) if eta is not None else ""

                on_progress({
                    "percentage": min(99.0, round(percentage, 1)),
                    "downloaded_bytes": downloaded,
                    "total_bytes": total,
                    "speed_str": speed_str,
                    "eta_str": eta_str,
                })
            elif d.get("status") == "finished":
                if on_progress:
                    on_progress({
                        "percentage": 92.0,
                        "downloaded_bytes": d.get("total_bytes") or 0,
                        "total_bytes": d.get("total_bytes") or 0,
                        "speed_str": "Completando corte...",
                        "eta_str": "0:00",
                    })

        def postprocessor_hook(d: Dict[str, Any]):
            status = d.get("status")
            if status == "started" and on_converting:
                on_converting()

        prog_file = output_dir / f"{item_id}_ffmpeg_progress.txt"
        if prog_file.exists():
            try:
                prog_file.unlink()
            except Exception:
                pass

        opts = self._get_base_opts()
        opts.update({
            "outtmpl": out_template,
            "download_ranges": download_range_func(None, [(st, et)]),
            "force_keyframes_at_cuts": True,
            "progress_hooks": [progress_hook],
            "postprocessor_hooks": [postprocessor_hook],
            "external_downloader_args": {
                "ffmpeg": ["-progress", str(prog_file)]
            },
        })

        if target_format == ClipFormat.MP3:
            # Audio clip extraction
            opts.update({
                "format": "bestaudio/best",
                "postprocessors": [
                    {
                        "key": "FFmpegExtractAudio",
                        "preferredcodec": "mp3",
                        "preferredquality": quality or "192",
                    },
                    {
                        "key": "FFmpegMetadata",
                        "add_metadata": True,
                    },
                ],
            })
        else:
            # Video clip muxing
            if quality and quality.isdigit():
                h = int(quality)
                format_selector = (
                    f"bestvideo[height<={h}][ext=mp4]+bestaudio[ext=m4a]/"
                    f"bestvideo[height<={h}]+bestaudio/"
                    f"bestvideo*[height<={h}]/"
                    f"best[height<={h}]/best"
                )
            else:
                format_selector = (
                    "bestvideo[ext=mp4]+bestaudio[ext=m4a]/"
                    "bestvideo+bestaudio/"
                    "bestvideo*/"
                    "best"
                )

            opts.update({
                "format": format_selector,
                "merge_output_format": "mp4",
                "postprocessors": [
                    {
                        "key": "FFmpegMetadata",
                        "add_metadata": True,
                    },
                ],
            })

        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=True)
                if "entries" in info:
                    info = list(info["entries"])[0]

                original_title = info.get("title") or "clip"
                artist = info.get("artist") or info.get("uploader") or info.get("channel") or ""
                video_duration = info.get("duration") or 0
                thumbnail = info.get("thumbnail")

                # Calculate clip duration
                actual_end = min(et, float(video_duration)) if (video_duration and et != float("inf")) else et
                clip_dur = int(round(actual_end - st)) if actual_end != float("inf") else None
                clip_duration_str = storage_adapter.format_duration(clip_dur) if clip_dur else "Parcial"

                # Locate the generated file
                target_ext = ".mp3" if target_format == ClipFormat.MP3 else ".mp4"
                target_files = list(output_dir.glob(f"{item_id}_*{target_ext}"))
                if not target_files and target_format == ClipFormat.MP4:
                    target_files = [f for f in output_dir.glob(f"{item_id}_*") if f.suffix.lower() in [".mp4", ".mkv", ".webm"]]

                if not target_files:
                    raise FileNotFoundError(f"El archivo de clip {target_ext} no fue generado correctamente.")

                current_file = target_files[0]

                # Construct clean final display name / disk name
                st_str = self.format_timestamp(st).replace(":", ".")
                et_str = (self.format_timestamp(et) if et != float("inf") else "fin").replace(":", ".")
                range_tag = f"[{st_str}-{et_str}]"

                if custom_title and custom_title.strip():
                    clean_custom = storage_adapter.sanitize_filename(custom_title.strip())
                    final_disk_name = f"{item_id}_{clean_custom}{target_ext}"
                    display_title = custom_title.strip()
                else:
                    clean_orig = storage_adapter.sanitize_filename(original_title)
                    final_disk_name = f"{item_id}_{range_tag}_{clean_orig}{target_ext}"
                    display_title = f"{range_tag} {original_title}"

                final_path = output_dir / final_disk_name
                if current_file != final_path:
                    try:
                        current_file.rename(final_path)
                    except Exception as e:
                        logger.warning(f"Could not rename {current_file} to {final_path}: {e}")
                        final_path = current_file

                file_size = final_path.stat().st_size

                return {
                    "filename": final_path.name,
                    "file_path": str(final_path),
                    "file_size": file_size,
                    "file_size_str": storage_adapter.format_bytes(file_size),
                    "title": display_title,
                    "artist": artist,
                    "duration": clip_dur,
                    "duration_str": clip_duration_str,
                    "thumbnail": thumbnail,
                }
        finally:
            if prog_file.exists():
                try:
                    prog_file.unlink()
                except Exception:
                    pass

clip_adapter = ClipAdapter()
