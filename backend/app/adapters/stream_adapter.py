import os
import re
import shutil
import logging
import urllib.parse
from typing import Callable, Optional, Dict, Any, Tuple
from pathlib import Path
from datetime import datetime
import yt_dlp

from backend.app.core.config import settings
from backend.app.adapters.storage_adapter import storage_adapter
from backend.app.domain.stream_models import StreamFormat, StreamProbeResponse

logger = logging.getLogger(__name__)

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)

class StreamAdapter:
    def __init__(self):
        self.ffmpeg_location = settings.FFMPEG_LOCATION
        self.node_path = settings.NODE_PATH
        self.deno_path = settings.DENO_PATH

    def _build_headers(
        self,
        referer: Optional[str] = None,
        user_agent: Optional[str] = None,
        origin: Optional[str] = None,
        custom_headers: Optional[Dict[str, str]] = None,
        cookies: Optional[str] = None,
    ) -> Dict[str, str]:
        """Constructs a comprehensive set of HTTP headers imitating a real browser."""
        ua = (user_agent or "").strip() or DEFAULT_USER_AGENT
        headers: Dict[str, str] = {
            "User-Agent": ua,
            "Accept": "*/*",
            "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
            "Sec-Ch-Ua": '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Linux"',
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "cross-site",
        }

        # Setup Referer & Origin
        ref = (referer or "").strip()
        if ref:
            headers["Referer"] = ref
            if not origin:
                try:
                    parsed = urllib.parse.urlparse(ref)
                    if parsed.scheme and parsed.netloc:
                        headers["Origin"] = f"{parsed.scheme}://{parsed.netloc}"
                except Exception:
                    pass

        orig = (origin or "").strip()
        if orig:
            headers["Origin"] = orig

        # Merge custom headers
        if custom_headers:
            for k, v in custom_headers.items():
                if k and v:
                    headers[k.strip()] = v.strip()

        # Cookies header
        ck = (cookies or "").strip()
        if ck:
            headers["Cookie"] = ck

        return headers

    def _get_ytdlp_opts(
        self,
        headers: Dict[str, str],
        cookies: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Base yt-dlp options configured with custom HTTP headers and network retries."""
        opts: Dict[str, Any] = {
            "quiet": True,
            "no_warnings": True,
            "ffmpeg_location": self.ffmpeg_location,
            "http_headers": headers,
            "noplaylist": True,
            "updatetime": False,
            "retries": 10,
            "fragment_retries": 10,
            "file_access_retries": 5,
            "socket_timeout": 30,
            "concurrent_fragment_downloads": 4,  # Accelerated parallel chunk downloads
            "hls_prefer_native": True,
        }

        # If user explicitly set Referer / User-Agent in headers, map them to yt-dlp core keys
        if "Referer" in headers:
            opts["referer"] = headers["Referer"]
        if "User-Agent" in headers:
            opts["user_agent"] = headers["User-Agent"]

        deno_bin = self.deno_path or shutil.which("deno")
        if deno_bin and os.path.exists(str(deno_bin)):
            opts["js_runtimes"] = {"deno": {"path": str(deno_bin)}}

        # Check global cookies if no custom raw cookie was set
        if not cookies:
            active_cookies = settings.get_active_cookies_file()
            if active_cookies:
                opts["cookiefile"] = str(active_cookies)

        return opts

    def probe_stream(
        self,
        url: str,
        referer: Optional[str] = None,
        user_agent: Optional[str] = None,
        origin: Optional[str] = None,
        custom_headers: Optional[Dict[str, str]] = None,
        cookies: Optional[str] = None,
    ) -> StreamProbeResponse:
        """
        Tests stream access with headers and retrieves media metadata without downloading.
        Returns a StreamProbeResponse with detailed diagnosis in case of 403 or errors.
        """
        headers = self._build_headers(referer, user_agent, origin, custom_headers, cookies)
        opts = self._get_ytdlp_opts(headers, cookies)
        opts["simulate"] = True

        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=False)
                if not info:
                    return StreamProbeResponse(
                        success=False,
                        error_message="No se pudo obtener información del stream proporcionado."
                    )

                title = info.get("title") or "Stream de video"
                duration = info.get("duration")
                duration_str = storage_adapter.format_duration(duration) if duration else None

                formats = info.get("formats") or []
                resolution = None
                if formats:
                    best_f = formats[-1]
                    w = best_f.get("width")
                    h = best_f.get("height")
                    if w and h:
                        resolution = f"{w}x{h}"
                    elif h:
                        resolution = f"{h}p"

                return StreamProbeResponse(
                    success=True,
                    status_code=200,
                    title=title,
                    duration=duration,
                    duration_str=duration_str,
                    resolution=resolution,
                    formats_count=len(formats),
                    raw_info={
                        "id": info.get("id"),
                        "ext": info.get("ext"),
                        "protocol": info.get("protocol"),
                        "format": info.get("format"),
                    }
                )

        except Exception as e:
            err_msg = str(e)
            logger.warning(f"Probe failed for {url}: {err_msg}")

            if "HTTP Error 403" in err_msg or "Forbidden" in err_msg:
                friendly = (
                    "HTTP 403 Forbidden: El servidor denegó el acceso. "
                    "Solución: Introduce en 'Referer' la URL exacta de la página donde se reproduce el video "
                    "y comprueba que el User-Agent sea idéntico al de tu navegador."
                )
            elif "HTTP Error 404" in err_msg or "Not Found" in err_msg:
                friendly = "HTTP 404 Not Found: El archivo .m3u8 o stream no existe o el token caducó."
            elif "SSL" in err_msg:
                friendly = "Error de conexión SSL al contactar el servidor de video."
            elif "Incomplete Read" in err_msg or "Connection reset" in err_msg:
                friendly = "Conexión interrumpida por el servidor remoto."
            else:
                friendly = f"Error al verificar stream: {err_msg[:180]}"

            return StreamProbeResponse(
                success=False,
                status_code=403 if "403" in err_msg else 400,
                error_message=friendly,
            )

    def download_with_ytdlp(
        self,
        url: str,
        output_dir: Path,
        item_id: str,
        target_format: StreamFormat = StreamFormat.MP4,
        custom_title: Optional[str] = None,
        referer: Optional[str] = None,
        user_agent: Optional[str] = None,
        origin: Optional[str] = None,
        custom_headers: Optional[Dict[str, str]] = None,
        cookies: Optional[str] = None,
        on_progress: Optional[Callable[[Dict[str, Any]], None]] = None,
        on_converting: Optional[Callable[[], None]] = None,
    ) -> Dict[str, Any]:
        """
        Downloads HLS/M3U8 stream using yt-dlp with configured HTTP headers and parallel fragment downloader.
        """
        output_dir.mkdir(parents=True, exist_ok=True)
        headers = self._build_headers(referer, user_agent, origin, custom_headers, cookies)
        opts = self._get_ytdlp_opts(headers, cookies)

        safe_title = storage_adapter.sanitize_filename(custom_title) if custom_title else "%(title).100B"
        out_template = str(output_dir / f"{item_id}_{safe_title}.%(ext)s")

        def progress_hook(d: Dict[str, Any]):
            if d.get("status") == "downloading" and on_progress:
                total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
                downloaded = d.get("downloaded_bytes") or 0
                percentage = (downloaded / total * 100.0) if total > 0 else 0.0

                speed = d.get("speed")
                speed_str = f"{storage_adapter.format_bytes(speed)}/s" if speed else ""

                eta = d.get("eta")
                eta_str = storage_adapter.format_duration(eta) if eta is not None else ""

                # For live or indefinite HLS streams, percentage might be 0, report downloaded bytes
                on_progress({
                    "percentage": min(99.0, round(percentage, 1)) if total > 0 else 0.0,
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
            if d.get("status") == "started" and on_converting:
                on_converting()

        opts["outtmpl"] = out_template
        opts["progress_hooks"] = [progress_hook]
        opts["postprocessor_hooks"] = [postprocessor_hook]

        if target_format == StreamFormat.MP3:
            opts["format"] = "bestaudio/best"
            opts["postprocessors"] = [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                    "preferredquality": "192",
                },
                {
                    "key": "FFmpegMetadata",
                    "add_metadata": True,
                },
            ]
        else:
            opts["format"] = "bestvideo+bestaudio/best"
            opts["merge_output_format"] = "mp4"
            opts["postprocessors"] = [
                {
                    "key": "FFmpegMetadata",
                    "add_metadata": True,
                },
            ]

        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
            if info and "entries" in info:
                entries = list(info["entries"])
                info = entries[0] if entries else {}

            title = custom_title or (info.get("title") if info else None) or "stream_video"
            duration = info.get("duration") if info else 0

            # Find matching file on disk
            ext = ".mp3" if target_format == StreamFormat.MP3 else ".mp4"
            target_files = list(output_dir.glob(f"{item_id}_*{ext}"))
            if not target_files:
                target_files = [f for f in output_dir.glob(f"{item_id}_*") if f.is_file()]

            if not target_files:
                raise FileNotFoundError("El archivo de video/audio no fue generado correctamente.")

            final_file = target_files[0]
            file_size = final_file.stat().st_size

            return {
                "filename": final_file.name,
                "file_path": str(final_file),
                "file_size": file_size,
                "file_size_str": storage_adapter.format_bytes(file_size),
                "title": title,
                "duration": duration,
                "duration_str": storage_adapter.format_duration(duration) if duration else None,
            }

stream_adapter = StreamAdapter()
