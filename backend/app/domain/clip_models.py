from enum import Enum
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from datetime import datetime
import uuid

class ClipFormat(str, Enum):
    MP4 = "mp4"
    MP3 = "mp3"

class ClipStatus(str, Enum):
    QUEUED = "queued"
    PROBING = "probing"
    DOWNLOADING = "downloading"
    CONVERTING = "converting"
    COMPLETED = "completed"
    ERROR = "error"
    CANCELLED = "cancelled"

class ClipProgress(BaseModel):
    percentage: float = 0.0
    downloaded_bytes: int = 0
    total_bytes: int = 0
    speed_str: str = ""
    eta_str: str = ""

class ClipProbeRequest(BaseModel):
    url: str

class ClipProbeResponse(BaseModel):
    success: bool
    title: Optional[str] = None
    artist: Optional[str] = None
    duration: Optional[int] = None
    duration_str: Optional[str] = None
    thumbnail: Optional[str] = None
    error_message: Optional[str] = None

class ClipDownloadRequest(BaseModel):
    url: str
    start_time: float = 0.0
    end_time: Optional[float] = None
    start_time_str: Optional[str] = "00:00"
    end_time_str: Optional[str] = None
    format: ClipFormat = ClipFormat.MP4
    quality: str = "1080"
    custom_title: Optional[str] = None

class ClipDownloadItem(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:10])
    url: str
    start_time: float = 0.0
    end_time: Optional[float] = None
    start_time_str: Optional[str] = "00:00"
    end_time_str: Optional[str] = None
    clip_duration_str: Optional[str] = None
    format: ClipFormat = ClipFormat.MP4
    quality: str = "1080"
    custom_title: Optional[str] = None
    status: ClipStatus = ClipStatus.QUEUED
    title: Optional[str] = None
    artist: Optional[str] = None
    thumbnail: Optional[str] = None
    filename: Optional[str] = None
    file_path: Optional[str] = None
    file_size: Optional[int] = None
    file_size_str: Optional[str] = None
    progress: ClipProgress = Field(default_factory=ClipProgress)
    error_message: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    completed_at: Optional[str] = None
