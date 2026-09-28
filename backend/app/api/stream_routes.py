import urllib.parse
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from backend.app.domain.stream_models import (
    StreamProbeRequest,
    StreamProbeResponse,
    StreamDownloadRequest,
    StreamDownloadItem,
    StreamStatus,
    StreamFormat,
)
from backend.app.services.stream_service import stream_service
from backend.app.adapters.storage_adapter import storage_adapter

stream_router = APIRouter(prefix="/api/stream", tags=["streams"])

@stream_router.post("/probe", response_model=StreamProbeResponse)
async def probe_stream_endpoint(request: StreamProbeRequest):
    """
    Probes an M3U8/HLS or direct video stream with provided headers (Referer, User-Agent, Cookies).
    Useful to verify if HTTP 403 Forbidden is bypassed before initiating a full download.
    """
    if not request.url or not request.url.strip():
        raise HTTPException(status_code=400, detail="Debe proporcionar una URL válida.")
    return await stream_service.probe(request)

@stream_router.post("/download", response_model=StreamDownloadItem)
async def create_stream_download(request: StreamDownloadRequest):
    """
    Enqueues and starts downloading an M3U8/HLS stream with custom HTTP headers.
    """
    if not request.url or not request.url.strip():
        raise HTTPException(status_code=400, detail="Debe proporcionar una URL válida.")
    return await stream_service.start_download(request)

@stream_router.get("/tasks", response_model=list[StreamDownloadItem])
async def list_stream_tasks():
    """Lists all active and completed stream download tasks."""
    return stream_service.get_all_items()

@stream_router.get("/tasks/{task_id}", response_model=StreamDownloadItem)
async def get_stream_task(task_id: str):
    """Retrieves current status and progress for a stream download task."""
    item = stream_service.get_item(task_id)
    if not item:
        raise HTTPException(status_code=404, detail="Tarea de stream no encontrada.")
    return item

@stream_router.get("/tasks/{task_id}/file")
async def download_stream_file(task_id: str):
    """Streams the completed MP4 or MP3 file for download to user browser."""
    item = stream_service.get_item(task_id)
    if not item:
        raise HTTPException(status_code=404, detail="Tarea de stream no encontrada.")
    if item.status != StreamStatus.COMPLETED or not item.filename:
        raise HTTPException(status_code=400, detail="El archivo aún no ha terminado de descargarse.")

    file_path = storage_adapter.get_file_path(item.filename)
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="El archivo no se encuentra en el servidor.")

    is_video = (item.format == StreamFormat.MP4) or file_path.suffix.lower() == ".mp4"
    ext = ".mp4" if is_video else ".mp3"
    media_type = "video/mp4" if is_video else "audio/mpeg"

    base_name = storage_adapter.sanitize_filename(item.title or "stream_video")
    display_name = f"{base_name}{ext}" if not base_name.lower().endswith(ext) else base_name

    ascii_name = display_name.encode("ascii", "ignore").decode("ascii").strip()
    if not ascii_name or ascii_name == ext:
        ascii_name = f"video{ext}"
    encoded_name = urllib.parse.quote(display_name)
    content_disposition = f'attachment; filename="{ascii_name}"; filename*=UTF-8\'\'{encoded_name}'

    return FileResponse(
        path=file_path,
        media_type=media_type,
        headers={"Content-Disposition": content_disposition},
    )

@stream_router.delete("/tasks/{task_id}")
async def delete_stream_task(task_id: str):
    """Cancels/deletes a stream download task and cleans disk files."""
    deleted = stream_service.remove_item(task_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Tarea de stream no encontrada.")
    return {"success": True, "message": "Tarea eliminada correctamente."}

@stream_router.post("/clear-completed")
async def clear_completed_stream_tasks():
    """Removes completed or errored stream items from history."""
    count = stream_service.clear_completed()
    return {"success": True, "cleared_count": count}
