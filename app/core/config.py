from __future__ import annotations
import os
from pathlib import Path
ROOT_DIR = Path(__file__).resolve().parents[2]
STATIC_DIR = ROOT_DIR / "app" / "static"
IS_VERCEL = bool(os.environ.get("VERCEL") or os.environ.get("VERCEL_ENV"))
SERVER_DOWNLOADS_ENABLED = os.environ.get("YTDLP_STUDIO_ALLOW_SERVER_DOWNLOADS", "").lower() in {"1", "true", "yes"} or not IS_VERCEL
DEFAULT_DOWNLOAD_DIR = Path(os.environ.get("YTDLP_STUDIO_DOWNLOAD_DIR") or ("/tmp/ytdlp-studio-downloads" if IS_VERCEL else str(ROOT_DIR / "downloads")))
try:
    DEFAULT_DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
except OSError:
    DEFAULT_DOWNLOAD_DIR = Path("/tmp/ytdlp-studio-downloads")
    DEFAULT_DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
