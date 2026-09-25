import re
import os
import time
import zipfile
import logging
from pathlib import Path
from typing import Optional, Set
from backend.app.core.config import settings

logger = logging.getLogger(__name__)

class StorageAdapter:
    def __init__(self, base_dir: Optional[Path] = None):
        self.base_dir = base_dir or settings.DOWNLOADS_DIR
        self.base_dir.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def sanitize_filename(name: str) -> str:
        """Removes or replaces characters that are problematic across filesystems."""
        name = re.sub(r'[\\/*?:"<>|]', "", name)
        name = name.strip().strip(".")
        return name or "audio"

    @staticmethod
    def clean_display_filename(filename: str) -> str:
        """
        Cleans the filename for user-facing downloads:
        - Removes internal 10-char hex prefix (e.g. '2a9adcff34_')
        - Removes '(Video Oficial)', '[Video Oficial]', '(Official Video)', etc.
        - Trims trailing separators and whitespace while preserving file extension.
        """
        # Strip internal id prefix
        cleaned = re.sub(r'^[a-fA-F0-9]{10}_', '', filename)
        base, ext = os.path.splitext(cleaned)

        # Remove video tags like (Video Oficial), [Video Oficial], (Official Video), (Visualizer), etc.
        tags_pattern = r'(?i)\s*[\(\[]\s*(?:video\s+oficial|official\s+video|official\s+music\s+video|audio\s+oficial|official\s+audio|video\s+lyric|lyric\s+video|(?:official\s+|audio\s+)?visualizer(?:\s+video)?)\s*[\)\]]'
        base = re.sub(tags_pattern, '', base)

        # Remove trailing dash/pipe labels like " - Video Oficial", " | Visualizer", etc.
        base = re.sub(r'(?i)\s*[-–—|]\s*(?:video\s+oficial|official\s+video|audio\s+oficial|official\s+audio|(?:official\s+|audio\s+)?visualizer(?:\s+video)?)\s*$', '', base)

        # Strip dangling separators or trailing whitespace
        base = re.sub(r'[\s\-–—|_]+$', '', base).strip()

        if base:
            return f"{base}{ext}"
        return cleaned if cleaned.strip() else filename

    @staticmethod
    def format_bytes(size_bytes: Optional[int]) -> str:
        """Converts bytes to human readable string (KB, MB, GB)."""
        if not size_bytes or size_bytes <= 0:
            return "0 B"
        units = ["B", "KB", "MB", "GB", "TB"]
        idx = 0
        n = float(size_bytes)
        while n >= 1024.0 and idx < len(units) - 1:
            n /= 1024.0
            idx += 1
        return f"{n:.1f} {units[idx]}"

    @staticmethod
    def format_duration(seconds: Optional[int]) -> str:
        """Converts seconds into MM:SS or HH:MM:SS format."""
        if not seconds or seconds <= 0:
            return "0:00"
        m, s = divmod(int(seconds), 60)
        h, m = divmod(m, 60)
        if h > 0:
            return f"{h}:{m:02d}:{s:02d}"
        return f"{m}:{s:02d}"

    def get_file_path(self, filename: str) -> Path:
        """Returns safe path to file within downloads directory."""
        safe_name = os.path.basename(filename)
        return self.base_dir / safe_name

    def file_exists(self, filename: str) -> bool:
        return self.get_file_path(filename).is_file()

    def get_file_size(self, filename: str) -> int:
        path = self.get_file_path(filename)
        if path.is_file():
            return path.stat().st_size
        return 0

    def delete_file(self, filename: str) -> bool:
        path = self.get_file_path(filename)
        if path.is_file():
            try:
                path.unlink()
                return True
            except OSError:
                return False
        return False

    def create_zip(self, filenames: list[str], zip_name: str = "ytdown_pack.zip") -> Path:
        """Packages given files into a single zip archive with clean track names."""
        zip_path = self.base_dir / zip_name
        used_arcnames: set[str] = set()
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
            for fname in filenames:
                fpath = self.get_file_path(fname)
                if fpath.is_file():
                    clean_name = self.clean_display_filename(fpath.name)
                    base, ext = os.path.splitext(clean_name)
                    arcname = clean_name
                    counter = 1
                    while arcname in used_arcnames:
                        arcname = f"{base} ({counter}){ext}"
                        counter += 1
                    used_arcnames.add(arcname)
                    zipf.write(fpath, arcname=arcname)
        return zip_path

    def clean_old_files(self, max_age_seconds: int = 900, active_ids: Optional[Set[str]] = None) -> list[str]:
        """
        Scans base_dir and deletes files that are older than max_age_seconds based on mtime.
        Excludes files that belong to currently active download tasks.
        Returns list of deleted filenames.
        """
        active_ids = active_ids or set()
        now = time.time()
        deleted_files: list[str] = []

        try:
            if not self.base_dir.exists():
                return deleted_files

            for item in self.base_dir.iterdir():
                if not item.is_file():
                    continue
                # Skip hidden files
                if item.name.startswith("."):
                    continue

                # Check if file belongs to an active download
                is_active = any(item.name.startswith(f"{aid}_") for aid in active_ids)
                if is_active:
                    continue

                try:
                    file_mtime = item.stat().st_mtime
                    age = now - file_mtime
                    if age >= max_age_seconds:
                        item.unlink()
                        deleted_files.append(item.name)
                        logger.info(f"Auto-cleaned expired file from downloads: {item.name} (age: {int(age)}s)")
                except OSError as e:
                    logger.warning(f"Error checking or deleting old file {item.name}: {e}")
        except Exception as e:
            logger.error(f"Error during clean_old_files in {self.base_dir}: {e}")

        return deleted_files

storage_adapter = StorageAdapter()
