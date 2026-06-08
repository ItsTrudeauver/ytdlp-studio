from __future__ import annotations

import shutil
import sys
from typing import Any

from fastapi import APIRouter

from app.core.config import DEFAULT_DOWNLOAD_DIR, IS_VERCEL, SERVER_DOWNLOADS_ENABLED
from app.services.ytdlp_probe import YoutubeDL

router = APIRouter()


@router.get("/api/health")
def health() -> dict[str, Any]:
    runtime_note = (
        "Vercel/serverless mode: analyze and command generation are supported; actual long downloads are disabled unless YTDLP_STUDIO_ALLOW_SERVER_DOWNLOADS=1."