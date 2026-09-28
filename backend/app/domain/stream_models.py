from enum import Enum
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from datetime import datetime
import uuid

class StreamFormat(str, Enum):
    MP4 = "mp4"
    MP3 = "mp3"

class StreamStatus(str, Enum):
    QUEUED = "queued"
    PROBING = "probing"
    DOWNLOADING = "downloading"
    CONVERTING = "converting"
    COMPLETED = "completed"
    ERROR = "error"
    CANCELLED = "cancelled"

class StreamProgress(BaseModel):
    percentage: float = 0.0
    downloaded_bytes: int = 0
    total_bytes: int = 0
    speed_str: str = ""
    eta_str: str = ""

class StreamProbeRequest(BaseModel):
    url: str
    referer: Optional[str] = None
    user_agent: Optional[str] = None
    origin: Optional[str] = None
    custom_headers: Optional[Dict[str, str]] = None
    cookies: Optional[str] = None

class StreamProbeResponse(BaseModel):
    success: bool
    status_code: Optional[int] = 200
    title: Optional[str] = None
    duration: Optional[int] = None
    duration_str: Optional[str] = None
    resolution: Optional[str] = None
    formats_count: int = 0
    raw_info: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None

class StreamDownloadRequest(BaseModel):
    url: str
    referer: Optional[str] = None
    user_agent: Optional[str] = None
    origin: Optional[str] = None
    custom_headers: Optional[Dict[str, str]] = None
    cookies: Optional[str] = None
    format: StreamFormat = StreamFormat.MP4
    custom_title: Optional[str] = None
    engine: str = "yt-dlp"  # "yt-dlp" or "ffmpeg"

class StreamDownloadItem(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:10])
    url: str
    referer: Optional[str] = None
    user_agent: Optional[str] = None
    custom_title: Optional[str] = None
    format: StreamFormat = StreamFormat.MP4
    engine: str = "yt-dlp"
    status: StreamStatus = StreamStatus.QUEUED
    title: Optional[str] = None
    filename: Optional[str] = None
    file_path: Optional[str] = None
    file_size: Optional[int] = None
    file_size_str: Optional[str] = None
    progress: StreamProgress = Field(default_factory=StreamProgress)
    error_message: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    completed_at: Optional[str] = None
