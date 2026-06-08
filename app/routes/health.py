from __future__ import annotations
import shutil, sys
from typing import Any
from fastapi import APIRouter
from app.core.config import DEFAULT_DOWNLOAD_DIR, IS_VERCEL, SERVER_DOWNLOADS_ENABLED
from app.services.ytdlp_probe import YoutubeDL

router = APIRouter()

@router.get('/api/health')
def health() -> dict[str, Any]:
    note = 'Hosted mode: analysis and command generation are supported; long downloads should be run locally.' if IS_VERCEL else 'Local mode: managed downloads are enabled.'