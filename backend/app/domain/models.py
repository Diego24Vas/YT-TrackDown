from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime
import uuid

class DownloadFormat(str, Enum):
    MP3 = "mp3"
    MP4 = "mp4"

class DownloadStatus(str, Enum):
    QUEUED = "queued"
    FETCHING_INFO = "fetching_info"
    DOWNLOADING = "downloading"
    CONVERTING = "converting"
    COMPLETED = "completed"
    EXPIRED = "expired"
    ERROR = "error"
    CANCELLED = "cancelled"

class DownloadProgress(BaseModel):
    percentage: float = 0.0
    downloaded_bytes: int = 0
    total_bytes: int = 0
    speed_str: str = ""
    eta_str: str = ""

class DownloadItem(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:10])
    url: str
    format: DownloadFormat = DownloadFormat.MP3
    quality: str = "192"
    status: DownloadStatus = DownloadStatus.QUEUED
    title: Optional[str] = None
    artist: Optional[str] = None
    duration: Optional[int] = None
    duration_str: Optional[str] = None
    thumbnail: Optional[str] = None
    filename: Optional[str] = None
    file_size: Optional[int] = None
    file_size_str: Optional[str] = None
    progress: DownloadProgress = Field(default_factory=DownloadProgress)
    error_message: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    completed_at: Optional[str] = None

class DownloadItemMetadata(BaseModel):
    url: str
    title: Optional[str] = None
    artist: Optional[str] = None
    duration: Optional[int] = None
    duration_str: Optional[str] = None
    thumbnail: Optional[str] = None

class BatchDownloadRequest(BaseModel):
    urls: list[str] = []
    items: Optional[list[DownloadItemMetadata]] = None
    format: DownloadFormat = DownloadFormat.MP3
    quality: str = "192"

class BatchDownloadResponse(BaseModel):
    items: list[DownloadItem]
    count: int

class SystemStats(BaseModel):
    total_items: int
    completed: int
    in_progress: int
    queued: int
    errors: int
    expired: int = 0

class PreviewItem(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:10])
    url: str
    title: str
    artist: Optional[str] = None
    duration: Optional[int] = None
    duration_str: Optional[str] = None
    thumbnail: Optional[str] = None
    source_url: Optional[str] = None
    playlist_id: Optional[str] = None
    playlist_title: Optional[str] = None

class PreviewRequest(BaseModel):
    urls: list[str]

class PreviewResponse(BaseModel):
    items: list[PreviewItem]
    count: int
