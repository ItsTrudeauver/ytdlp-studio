from __future__ import annotations
import os, subprocess, sys
from typing import Any
from fastapi import APIRouter, HTTPException
from app.core.config import DEFAULT_DOWNLOAD_DIR, IS_VERCEL
from app.models.schemas import DirectoryRequest
from app.services.validation import resolve_download_dir
router = APIRouter()
@router.post("/api/directory/validate")
def validate_directory(req: DirectoryRequest) -> dict[str, Any]:
    path = resolve_download_dir(req.path); return {"path": str(path)}
@router.post("/api/directory/select")
def select_directory() -> dict[str, Any]:
    if IS_VERCEL: raise HTTPException(status_code=400, detail="Folder browsing is only available in local mode.")
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk(); root.withdraw(); root.attributes("-topmost", True); selected = filedialog.askdirectory(initialdir=str(DEFAULT_DOWNLOAD_DIR)); root.destroy()
    except Exception as exc: raise HTTPException(status_code=400, detail=f"Native folder picker unavailable: {exc}") from exc
    if not selected: raise HTTPException(status_code=400, detail="No folder selected.")
    path = resolve_download_dir(selected); return {"path": str(path)}
@router.post("/api/directory/open")
def open_directory(req: DirectoryRequest) -> dict[str, Any]:
    if IS_VERCEL: raise HTTPException(status_code=400, detail="Opening a folder is only available in local mode.")
    path = resolve_download_dir(req.path)
    try:
        if sys.platform.startswith("win"): os.startfile(path)  # type: ignore[attr-defined]
        elif sys.platform == "darwin": subprocess.Popen(["open", str(path)])
        else: subprocess.Popen(["xdg-open", str(path)])
    except Exception as exc: raise HTTPException(status_code=400, detail=f"Could not open folder: {exc}") from exc
    return {"ok": True, "path": str(path)}
