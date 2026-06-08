from __future__ import annotations
import shutil, sys
from typing import Any
from fastapi import APIRouter
from app.core.config import DEFAULT_DOWNLOAD_DIR, IS_VERCEL, SERVER_DOWNLOADS_ENABLED
from app.services.ytdlp_probe import YoutubeDL
router = APIRouter()
@router.get("/api/health")
def health() -> dict[str, Any]:
    return {"ok": True, "download_dir": str(DEFAULT_DOWNLOAD_DIR), "python": sys.version.split()[0], "yt_dlp_module": YoutubeDL is not None, "yt_dlp_exe": shutil.which("yt-dlp"), "ffmpeg": shutil.which("ffmpeg"), "platform": sys.platform, "serverless": IS_VERCEL, "downloads_enabled": SERVER_DOWNLOADS_ENABLED, "runtime_note": "Vercel/serverless mode: analyze and command generation are supported; actual long downloads are disabled unless YTDLP_STUDIO_ALLOW_SERVER_DOWNLOADS=1." if IS_VERCEL else "Local mode: managed downloads are enabled."}
