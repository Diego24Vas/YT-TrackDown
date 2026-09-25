import os
import shutil
from pathlib import Path
from pydantic import BaseModel

_DEFAULT_BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
BASE_DIR = Path(os.getenv("BASE_DIR", str(_DEFAULT_BASE_DIR)))
DOWNLOADS_DIR = Path(os.getenv("DOWNLOADS_DIR", str(BASE_DIR / "downloads")))
FRONTEND_DIR = Path(os.getenv("FRONTEND_DIR", str(BASE_DIR / "frontend")))

class Settings(BaseModel):
    PROJECT_NAME: str = "YT-TrackDown"
    VERSION: str = "1.0.0"
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8080"))
    
    # Paths
    BASE_DIR: Path = BASE_DIR
    DOWNLOADS_DIR: Path = DOWNLOADS_DIR
    FRONTEND_DIR: Path = FRONTEND_DIR
    
    # External Tools (detected dynamically with fallback)
    FFMPEG_LOCATION: str = os.getenv(
        "FFMPEG_LOCATION",
        shutil.which("ffmpeg") or "/usr/bin/ffmpeg"
    )
    NODE_PATH: str = os.getenv(
        "NODE_PATH",
        shutil.which("node") or "/usr/bin/node"
    )
    
    # Concurrency and Limits
    MAX_CONCURRENT_DOWNLOADS: int = int(os.getenv("MAX_CONCURRENT_DOWNLOADS", "2"))
    DEFAULT_AUDIO_QUALITY: str = os.getenv("DEFAULT_AUDIO_QUALITY", "192")  # kbps
    ALLOWED_QUALITIES: list[str] = ["128", "192", "256", "320"]

    # File Retention & Auto-Cleanup (in minutes, default: 15)
    FILE_RETENTION_MINUTES: int = int(os.getenv("FILE_RETENTION_MINUTES", "15"))
    CLEANUP_CHECK_INTERVAL_SECONDS: int = int(os.getenv("CLEANUP_CHECK_INTERVAL_SECONDS", "30"))

    @property
    def FILE_RETENTION_SECONDS(self) -> int:
        return self.FILE_RETENTION_MINUTES * 60

settings = Settings()

# Ensure downloads directory exists
settings.DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)
