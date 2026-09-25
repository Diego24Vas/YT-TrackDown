import os
import re
import logging
from typing import Callable, Optional, Dict, Any
from pathlib import Path
from datetime import datetime
import yt_dlp

from backend.app.core.config import settings
from backend.app.adapters.storage_adapter import storage_adapter

logger = logging.getLogger(__name__)

class YtDlpAdapter:
    def __init__(self):
        self.ffmpeg_location = settings.FFMPEG_LOCATION
        self.node_path = settings.NODE_PATH

    def _get_base_opts(self) -> Dict[str, Any]:
        """Returns standard options for yt_dlp extraction and downloading."""
        opts: Dict[str, Any] = {
            "quiet": True,
            "no_warnings": True,
            "ffmpeg_location": self.ffmpeg_location,
            "remote_components": ["ejs:github"],
            "noplaylist": True,
            "updatetime": False,
        }
        active_cookies = settings.get_active_cookies_file()
        if active_cookies:
            opts["cookiefile"] = str(active_cookies)
        return opts

    def expand_url(self, url: str) -> list[Dict[str, Any]]:
        """
        Resolves a URL. If it's a playlist, unpacks all individual entries
        using fast flat extraction without downloading video streams.
        If it's a single track, returns a 1-item list.
        """
        flat_opts: Dict[str, Any] = {
            "quiet": True,
            "no_warnings": True,
            "extract_flat": "in_playlist",
            "skip_download": True,
            "ffmpeg_location": self.ffmpeg_location,
            "remote_components": ["ejs:github"],
        }
        active_cookies = settings.get_active_cookies_file()
        if active_cookies:
            flat_opts["cookiefile"] = str(active_cookies)
        
        try:
            with yt_dlp.YoutubeDL(flat_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                if not info:
                    return [{"url": url}]

                # Check if it's a playlist or collection
                if info.get("_type") == "playlist" or "entries" in info:
                    entries = list(info.get("entries") or [])
                    if not entries:
                        return [{"url": url, "source_url": url, "playlist_id": None, "playlist_title": None}]

                    playlist_id = info.get("id")
                    if not playlist_id:
                        m = re.search(r'[?&]list=([a-zA-Z0-9_-]+)', url)
                        if m:
                            playlist_id = m.group(1)
                    playlist_title = info.get("title") or "Playlist"

                    items = []
                    for entry in entries:
                        if not entry:
                            continue
                        
                        v_url = entry.get("url")
                        if not v_url or not str(v_url).startswith("http"):
                            v_id = entry.get("id") or entry.get("url")
                            v_url = f"https://www.youtube.com/watch?v={v_id}"
                        
                        thumb = entry.get("thumbnail")
                        if not thumb and entry.get("thumbnails"):
                            thumb = entry["thumbnails"][-1].get("url")
                        
                        duration = entry.get("duration")
                        duration_str = storage_adapter.format_duration(duration) if duration else None

                        items.append({
                            "url": v_url,
                            "title": entry.get("title") or "Audio",
                            "artist": entry.get("uploader") or entry.get("channel") or entry.get("artist") or "",
                            "duration": duration,
                            "duration_str": duration_str,
                            "thumbnail": thumb,
                            "source_url": url,
                            "playlist_id": playlist_id,
                            "playlist_title": playlist_title,
                        })
                    return items
                else:
                    duration = info.get("duration")
                    duration_str = storage_adapter.format_duration(duration) if duration else None
                    return [{
                        "url": url,
                        "title": info.get("title"),
                        "artist": info.get("artist") or info.get("uploader") or info.get("channel"),
                        "duration": duration,
                        "duration_str": duration_str,
                        "thumbnail": info.get("thumbnail"),
                        "source_url": url,
                        "playlist_id": None,
                        "playlist_title": None,
                    }]
        except Exception as e:
            logger.warning(f"Error expanding URL {url}: {e}")
            return [{"url": url, "source_url": url, "playlist_id": None, "playlist_title": None}]

    def extract_info(self, url: str) -> Dict[str, Any]:
        """Extracts media metadata without downloading."""
        opts = self._get_base_opts()
        opts["simulate"] = True
        
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
            if not info:
                raise ValueError("No se pudo obtener información del enlace proporcionado.")
            
            # If playlist is returned despite noplaylist, grab the first entry
            if "entries" in info:
                entries = list(info["entries"])
                if entries:
                    info = entries[0]
                else:
                    raise ValueError("Lista de reproducción vacía.")
            
            title = info.get("title") or "Audio desconocido"
            artist = info.get("artist") or info.get("uploader") or info.get("channel") or "Artista desconocido"
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

    def download_audio(
        self,
        url: str,
        output_dir: Path,
        item_id: str,
        quality: str = "192",
        on_progress: Optional[Callable[[Dict[str, Any]], None]] = None,
        on_converting: Optional[Callable[[], None]] = None,
    ) -> Dict[str, Any]:
        """
        Downloads audio from url, converts to mp3, and calls progress hooks.
        Returns final file details: {filename, file_path, file_size, title, artist, thumbnail}
        """
        output_dir.mkdir(parents=True, exist_ok=True)
        # Template uses item_id prefix to ensure unique filename on disk, followed by title
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
                        "percentage": 100.0,
                        "downloaded_bytes": d.get("total_bytes") or 0,
                        "total_bytes": d.get("total_bytes") or 0,
                        "speed_str": "Completando...",
                        "eta_str": "0:00",
                    })

        def postprocessor_hook(d: Dict[str, Any]):
            status = d.get("status")
            pp_name = d.get("postprocessor")
            if status == "started" and pp_name == "ExtractAudio" and on_converting:
                on_converting()

        opts = self._get_base_opts()
        opts.update({
            "format": "bestaudio/best",
            "outtmpl": out_template,
            "postprocessors": [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                    "preferredquality": quality,
                },
                {
                    "key": "FFmpegMetadata",
                    "add_metadata": True,
                },
            ],
            "progress_hooks": [progress_hook],
            "postprocessor_hooks": [postprocessor_hook],
        })

        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
            if "entries" in info:
                info = list(info["entries"])[0]

            title = info.get("title") or "audio"
            artist = info.get("artist") or info.get("uploader") or info.get("channel") or ""
            duration = info.get("duration") or 0
            thumbnail = info.get("thumbnail")

            # Locate the generated .mp3 file
            # yt_dlp replaces extension with .mp3
            target_files = list(output_dir.glob(f"{item_id}_*.mp3"))
            if not target_files:
                raise FileNotFoundError("El archivo de audio .mp3 no fue generado correctamente.")
            
            final_file = target_files[0]
            file_size = final_file.stat().st_size
            
            return {
                "filename": final_file.name,
                "file_path": str(final_file),
                "file_size": file_size,
                "file_size_str": storage_adapter.format_bytes(file_size),
                "title": title,
                "artist": artist,
                "duration": duration,
                "duration_str": storage_adapter.format_duration(duration),
                "thumbnail": thumbnail,
            }

    def has_cookies(self) -> bool:
        """Returns True if a valid cookies file is detected."""
        return settings.get_active_cookies_file() is not None

    def get_cookies_status(self) -> Dict[str, Any]:
        """Returns status metadata about current cookies configuration."""
        active_file = settings.get_active_cookies_file()
        if not active_file:
            return {
                "has_cookies": False,
                "file_name": None,
                "file_path": None,
                "size_bytes": 0,
                "size_str": "0 B",
                "updated_at": None,
                "valid_lines": 0,
            }

        stat = active_file.stat()
        valid_lines = 0
        try:
            with open(active_file, "r", encoding="utf-8", errors="ignore") as f:
                for line in f:
                    stripped = line.strip()
                    if stripped and not stripped.startswith("#"):
                        valid_lines += 1
        except Exception:
            pass

        return {
            "has_cookies": True,
            "file_name": active_file.name,
            "file_path": str(active_file),
            "size_bytes": stat.st_size,
            "size_str": storage_adapter.format_bytes(stat.st_size),
            "updated_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            "valid_lines": valid_lines,
        }

    def save_cookies(self, content: str | bytes) -> Dict[str, Any]:
        """Saves or updates cookies.txt in the configured COOKIES_FILE path."""
        target_path = settings.COOKIES_FILE
        target_path.parent.mkdir(parents=True, exist_ok=True)

        if isinstance(content, str):
            with open(target_path, "w", encoding="utf-8") as f:
                f.write(content)
        else:
            with open(target_path, "wb") as f:
                f.write(content)

        return self.get_cookies_status()

    def delete_cookies(self) -> bool:
        """Deletes any configured cookies file."""
        deleted = False
        candidates = [
            settings.COOKIES_FILE,
            settings.COOKIES_DIR / "cookies.txt",
            settings.BASE_DIR / "cookies.txt",
            settings.DOWNLOADS_DIR / "cookies.txt",
            Path("/app/cookies/cookies.txt"),
        ]
        for p in candidates:
            try:
                if p.is_file():
                    p.unlink()
                    deleted = True
            except Exception as e:
                logger.warning(f"Could not delete cookie file {p}: {e}")
        return deleted

ytdlp_adapter = YtDlpAdapter()
