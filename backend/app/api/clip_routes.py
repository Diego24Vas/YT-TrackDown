import urllib.parse
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from backend.app.domain.clip_models import (
    ClipProbeRequest,
    ClipProbeResponse,
    ClipDownloadRequest,
    ClipDownloadItem,
    ClipStatus,
    ClipFormat,
)
from backend.app.services.clip_service import clip_service
from backend.app.adapters.storage_adapter import storage_adapter

clip_router = APIRouter(prefix="/api/clips", tags=["clips"])

@clip_router.post("/probe", response_model=ClipProbeResponse)
async def probe_clip_endpoint(request: ClipProbeRequest):
    """
    Inspects video URL to extract title, duration, and thumbnail without downloading.
    Allows the user to view total duration to set start and end timestamps.
    """
    if not request.url or not request.url.strip():
        raise HTTPException(status_code=400, detail="Debe proporcionar una URL válida.")
    return await clip_service.probe(request)

@clip_router.post("/download", response_model=ClipDownloadItem)
async def create_clip_download(request: ClipDownloadRequest):
    """
    Enqueues and starts downloading a clip defined by start_time and end_time timestamps.
    """
    if not request.url or not request.url.strip():
        raise HTTPException(status_code=400, detail="Debe proporcionar una URL válida.")
    return await clip_service.start_download(request)

@clip_router.get("/tasks", response_model=list[ClipDownloadItem])
async def list_clip_tasks():
    """Lists all active and completed clip download tasks."""
    return clip_service.get_all_items()

@clip_router.get("/tasks/{task_id}", response_model=ClipDownloadItem)
async def get_clip_task(task_id: str):
    """Retrieves current status and progress for a specific clip download task."""
    item = clip_service.get_item(task_id)
    if not item:
        raise HTTPException(status_code=404, detail="Tarea de clip no encontrada.")
    return item

@clip_router.get("/tasks/{task_id}/file")
async def download_clip_file(task_id: str):
    """Streams the cut clip MP4 or MP3 file for user download."""
    item = clip_service.get_item(task_id)
    if not item:
        raise HTTPException(status_code=404, detail="Tarea de clip no encontrada.")
    if item.status != ClipStatus.COMPLETED or not item.filename:
        raise HTTPException(status_code=400, detail="El clip aún no ha terminado de generarse.")

    file_path = storage_adapter.get_file_path(item.filename)
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="El archivo del clip no se encuentra en el servidor.")

    is_video = (item.format == ClipFormat.MP4) or file_path.suffix.lower() == ".mp4"
    ext = ".mp4" if is_video else ".mp3"
    media_type = "video/mp4" if is_video else "audio/mpeg"

    base_name = storage_adapter.sanitize_filename(item.title or "clip")
    display_name = f"{base_name}{ext}" if not base_name.lower().endswith(ext) else base_name

    ascii_name = display_name.encode("ascii", "ignore").decode("ascii").strip()
    if not ascii_name or ascii_name == ext:
        ascii_name = f"clip{ext}"
    encoded_name = urllib.parse.quote(display_name)
    content_disposition = f'attachment; filename="{ascii_name}"; filename*=UTF-8\'\'{encoded_name}'

    return FileResponse(
        path=file_path,
        media_type=media_type,
        headers={"Content-Disposition": content_disposition},
    )

@clip_router.delete("/tasks/{task_id}")
async def delete_clip_task(task_id: str):
    """Cancels or deletes a clip download task and cleans disk files."""
    deleted = clip_service.remove_item(task_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Tarea de clip no encontrada.")
    return {"success": True, "message": "Tarea de clip eliminada correctamente."}

@clip_router.post("/clear-completed")
async def clear_completed_clip_tasks():
    """Removes completed or errored clip items from history."""
    count = clip_service.clear_completed()
    return {"success": True, "cleared_count": count}
