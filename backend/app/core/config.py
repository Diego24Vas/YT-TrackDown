import os
import shutil
from pathlib import Path
from typing import Optional
from pydantic import BaseModel

_DEFAULT_BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent

# Cargar automáticamente el archivo .env si existe
_env_file = _DEFAULT_BASE_DIR / ".env"
try:
    from dotenv import load_dotenv
    if _env_file.is_file():
        load_dotenv(dotenv_path=_env_file)
    else:
        load_dotenv()
except ImportError:
    if _env_file.is_file():
        try:
            with open(_env_file, "r", encoding="utf-8") as _f:
                for _line in _f:
                    _line = _line.strip()
                    if _line and not _line.startswith("#") and "=" in _line:
                        _k, _v = _line.split("=", 1)
                        _k, _v = _k.strip(), _v.strip().strip("'\"")
                        if _k not in os.environ:
                            os.environ[_k] = _v
        except Exception:
            pass

BASE_DIR = Path(os.getenv("BASE_DIR", str(_DEFAULT_BASE_DIR)))
DOWNLOADS_DIR = Path(os.getenv("DOWNLOADS_DIR", str(BASE_DIR / "downloads")))
FRONTEND_DIR = Path(os.getenv("FRONTEND_DIR", str(BASE_DIR / "frontend")))
COOKIES_DIR = Path(os.getenv("COOKIES_DIR", str(BASE_DIR / "cookies")))
COOKIES_FILE = Path(os.getenv("COOKIES_FILE", str(COOKIES_DIR / "cookies.txt")))

class Settings(BaseModel):
    PROJECT_NAME: str = "YT-TrackDown"
    VERSION: str = "1.0.0"
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8080"))
    
    # Paths
    BASE_DIR: Path = BASE_DIR
    DOWNLOADS_DIR: Path = DOWNLOADS_DIR
    FRONTEND_DIR: Path = FRONTEND_DIR
    COOKIES_DIR: Path = COOKIES_DIR
    COOKIES_FILE: Path = COOKIES_FILE
    
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

    def get_active_cookies_file(self) -> Optional[Path]:
        """
        Locates the first existing and non-empty cookies file.
        Checks:
        1. Configured COOKIES_FILE
        2. COOKIES_DIR / 'cookies.txt'
        3. BASE_DIR / 'cookies.txt'
        4. DOWNLOADS_DIR / 'cookies.txt'
        5. Common container paths (/app/cookies/cookies.txt, /app/cookies.txt)
        """
        candidate_paths = [
            self.COOKIES_FILE,
            self.COOKIES_DIR / "cookies.txt",
            self.BASE_DIR / "cookies.txt",
            self.DOWNLOADS_DIR / "cookies.txt",
            Path("/app/cookies/cookies.txt"),
            Path("/app/cookies.txt"),
        ]
        
        for path in candidate_paths:
            try:
                if path.is_file() and path.stat().st_size > 0:
                    return path
            except Exception:
                continue
        return None

settings = Settings()

# Ensure directories exist
settings.DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)
settings.COOKIES_DIR.mkdir(parents=True, exist_ok=True)
