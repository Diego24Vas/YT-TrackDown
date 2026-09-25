import os
import asyncio
import urllib.parse
from fastapi import APIRouter, HTTPException, BackgroundTasks, UploadFile, File
from fastapi.responses import FileResponse
from backend.app.domain.models import (
    BatchDownloadRequest,
    BatchDownloadResponse,
    DownloadItem,
    SystemStats,
    DownloadStatus,
    PreviewRequest,
    PreviewResponse,
    PreviewItem,
)
from backend.app.core.config import settings
from backend.app.services.queue_service import queue_service
from backend.app.adapters.storage_adapter import storage_adapter
from backend.app.adapters.ytdlp_adapter import ytdlp_adapter

router = APIRouter(prefix="/api", tags=["downloads"])

@router.post("/preview", response_model=PreviewResponse)
async def preview_urls(request: PreviewRequest):
    """
    Inspects media URLs and playlists without downloading.
    Returns title, duration, artist, and thumbnail for each track.
    """
    if not request.urls:
        raise HTTPException(status_code=400, detail="Debe proporcionar al menos una URL válida.")

    cleaned_urls = [u.strip() for u in request.urls if u.strip()]
    if not cleaned_urls:
        raise HTTPException(status_code=400, detail="No se encontraron URLs válidas.")

    async def process_preview_url(raw_url: str) -> list[PreviewItem]:
        try:
            expanded = await asyncio.to_thread(ytdlp_adapter.expand_url, raw_url)
            items = []
            for entry in expanded:
                v_url = entry.get("url")
                if not v_url:
                    continue
                items.append(
                    PreviewItem(
                        url=v_url,
                        title=entry.get("title") or "Audio",
                        artist=entry.get("artist") or "",
                        duration=entry.get("duration"),
                        duration_str=entry.get("duration_str"),
                        thumbnail=entry.get("thumbnail"),
                        source_url=entry.get("source_url") or raw_url,
                        playlist_id=entry.get("playlist_id"),
                        playlist_title=entry.get("playlist_title"),
                    )
                )
            return items
        except Exception:
            return [
                PreviewItem(
                    url=raw_url,
                    title="Audio",
                    artist="",
                    source_url=raw_url,
                )
            ]

    # Process all preview URLs concurrently
    results = await asyncio.gather(*(process_preview_url(u) for u in cleaned_urls))
    preview_items: list[PreviewItem] = [item for sublist in results for item in sublist]

    return PreviewResponse(items=preview_items, count=len(preview_items))

@router.post("/downloads", response_model=BatchDownloadResponse)
async def create_downloads(request: BatchDownloadRequest):
    """Enqueues a list of media URLs for MP3 download."""
    if not request.urls:
        raise HTTPException(status_code=400, detail="Debe proporcionar al menos una URL válida.")
    
    # Filter out empty or whitespace lines
    cleaned_urls = [u.strip() for u in request.urls if u.strip()]
    if not cleaned_urls:
        raise HTTPException(status_code=400, detail="No se encontraron URLs válidas en la petición.")

    items = await queue_service.add_items(cleaned_urls, quality=request.quality)
    return BatchDownloadResponse(items=items, count=len(items))

@router.get("/downloads", response_model=list[DownloadItem])
async def list_downloads():
    """Returns all current items in queue and history."""
    return queue_service.get_all_items()

@router.get("/downloads/{item_id}", response_model=DownloadItem)
async def get_download(item_id: str):
    """Returns details for a single download item."""
    item = queue_service.get_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Descarga no encontrada.")
    return item

@router.get("/downloads/{item_id}/file")
async def download_mp3_file(item_id: str):
    """Streams the converted MP3 file to browser for direct download."""
    item = queue_service.get_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Descarga no encontrada.")
    if item.status == DownloadStatus.EXPIRED:
        raise HTTPException(
            status_code=410,
            detail=f"El archivo ha expirado tras {settings.FILE_RETENTION_MINUTES} minutos y fue eliminado del servidor para liberar espacio. Puedes reintentar la descarga."
        )
    if item.status != DownloadStatus.COMPLETED or not item.filename:
        raise HTTPException(status_code=400, detail="El archivo aún no ha terminado de descargarse.")

    file_path = storage_adapter.get_file_path(item.filename)
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="El archivo no se encuentra en el servidor.")

    # Friendly downloaded filename without internal id prefix or video tags
    if item.title:
        clean_name = storage_adapter.clean_display_filename(item.title)
        base_name = storage_adapter.sanitize_filename(clean_name)
        display_name = f"{base_name}.mp3" if not base_name.lower().endswith(".mp3") else base_name
    elif item.filename:
        clean_name = storage_adapter.clean_display_filename(item.filename)
        display_name = storage_adapter.sanitize_filename(clean_name)
    else:
        display_name = "audio.mp3"

    # RFC 6266 / RFC 5987 standard headers: ASCII fallback + UTF-8 encoded
    ascii_name = display_name.encode("ascii", "ignore").decode("ascii").strip()
    if not ascii_name or ascii_name == ".mp3":
        ascii_name = "audio.mp3"
    encoded_name = urllib.parse.quote(display_name)
    content_disposition = f'attachment; filename="{ascii_name}"; filename*=UTF-8\'\'{encoded_name}'

    return FileResponse(
        path=file_path,
        media_type="audio/mpeg",
        headers={"Content-Disposition": content_disposition},
    )

@router.post("/downloads/{item_id}/retry")
async def retry_download(item_id: str):
    """Retries a failed download item."""
    item = queue_service.retry_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Descarga no encontrada.")
    return item

@router.delete("/downloads/{item_id}")
async def delete_download(item_id: str):
    """Deletes an item from list and cleans disk file."""
    deleted = queue_service.remove_item(item_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Descarga no encontrada.")
    return {"success": True, "message": "Elemento eliminado correctamente."}

@router.post("/downloads/clear-completed")
async def clear_completed():
    """Removes all finished items from queue."""
    count = queue_service.clear_completed()
    return {"success": True, "cleared_count": count}

@router.get("/downloads/export/zip")
async def export_all_zip(background_tasks: BackgroundTasks):
    """Packages all completed MP3 files into a zip file."""
    completed_items = [
        item for item in queue_service.get_all_items()
        if item.status == DownloadStatus.COMPLETED and item.filename and storage_adapter.file_exists(item.filename)
    ]
    if not completed_items:
        raise HTTPException(status_code=400, detail="No hay archivos completados para empaquetar.")

    filenames = [i.filename for i in completed_items]
    zip_path = storage_adapter.create_zip(filenames, zip_name="musica_descargada.zip")

    # Schedule zip removal after sending
    background_tasks.add_task(storage_adapter.delete_file, zip_path.name)

    return FileResponse(
        path=zip_path,
        media_type="application/zip",
        filename="YT-TrackDown_audios.zip",
    )

@router.get("/stats", response_model=SystemStats)
async def get_system_stats():
    """Returns current system queue counts."""
    return queue_service.get_stats()

@router.get("/cookies")
async def get_cookies_status():
    """Returns the current status of configured YouTube authentication cookies."""
    return ytdlp_adapter.get_cookies_status()

@router.post("/cookies/upload")
async def upload_cookies(file: UploadFile = File(...)):
    """
    Uploads and validates a cookies.txt file to authenticate with YouTube
    for age-restricted, members-only, or private videos.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Debe seleccionar un archivo válido.")

    content_bytes = await file.read()
    if not content_bytes or len(content_bytes) == 0:
        raise HTTPException(status_code=400, detail="El archivo de cookies está vacío.")

    if len(content_bytes) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="El archivo de cookies excede el tamaño máximo permitido (5MB).")

    try:
        content_text = content_bytes.decode("utf-8", errors="ignore")
    except Exception:
        raise HTTPException(status_code=400, detail="No se pudo decodificar el contenido del archivo de cookies.")

    # Validate basic Netscape cookie format or presence of domain info
    lines = content_text.splitlines()
    has_valid_cookie_lines = any(
        "\t" in line and len(line.split("\t")) >= 5
        for line in lines
        if line.strip() and not line.strip().startswith("#")
    )
    is_netscape_header = any("# Netscape HTTP Cookie File" in line for line in lines[:5])
    has_youtube_domain = "youtube.com" in content_text.lower() or "google.com" in content_text.lower()

    if not (has_valid_cookie_lines or is_netscape_header or has_youtube_domain):
        raise HTTPException(
            status_code=400,
            detail="El formato del archivo no parece ser un cookies.txt válido (formato Netscape)."
        )

    status = ytdlp_adapter.save_cookies(content_bytes)
    return {
        "success": True,
        "message": "Archivo cookies.txt cargado y activado correctamente.",
        "status": status,
    }

@router.delete("/cookies")
async def delete_cookies():
    """Removes configured cookies and resets to anonymous mode."""
    deleted = ytdlp_adapter.delete_cookies()
    return {
        "success": True,
        "message": "Cookies eliminadas correctamente." if deleted else "No se encontraron cookies para eliminar.",
        "status": ytdlp_adapter.get_cookies_status(),
    }
