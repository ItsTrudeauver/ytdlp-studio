from __future__ import annotations
import os
from pathlib import Path

# Anchor directly from the directory this config file lives in (app/core)
CURRENT_DIR = Path(__file__).resolve().parent

# Fallback clean resolution for APP and ROOT layers
APP_DIR = CURRENT_DIR.parent
ROOT_DIR = APP_DIR.parent

# Set the static folder relative to the verified app directory
STATIC_DIR = APP_DIR / "static"

# Environment configuration states
IS_VERCEL = bool(os.environ.get("VERCEL") or os.environ.get("VERCEL_ENV"))
SERVER_DOWNLOADS_ENABLED = os.environ.get("YTDLP_STUDIO_ALLOW_SERVER_DOWNLOADS", "").lower() in {"1", "true", "yes"} or not IS_VERCEL

# Safe folder creation fallback for /tmp allocation under lambda scope
DEFAULT_DOWNLOAD_DIR = Path(os.environ.get("YTDLP_STUDIO_DOWNLOAD_DIR") or ("/tmp/ytdlp-studio-downloads" if IS_VERCEL else str(ROOT_DIR / "downloads")))

try:
    DEFAULT_DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
except OSError:
    DEFAULT_DOWNLOAD_DIR = Path("/tmp/ytdlp-studio-downloads")
    DEFAULT_DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)