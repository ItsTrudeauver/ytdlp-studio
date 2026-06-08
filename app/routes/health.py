from __future__ import annotations
import shutil,sys
from fastapi import APIRouter
from app.core.config import DEFAULT_DOWNLOAD_DIR,IS_VERCEL,SERVER_DOWNLOADS_ENABLED
from app.services.ytdlp_probe import YoutubeDL
router=APIRouter()
@router.get('/api/health')
def health():
    return {'ok':True,'status':'ok','download_dir':str(DEFAULT_DOWNLOAD_DIR),'python':sys.version.split()[0