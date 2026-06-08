from __future__ import annotations
import threading, time, uuid
from typing import Any
from fastapi import APIRouter, HTTPException
from app.core.config import SERVER_DOWNLOADS_ENABLED
from app.models.schemas import DownloadRequest
from app.services.jobs import download_worker, get_job, resume_process_tree, set_job, suspend_process_tree, terminate_process_tree
from app.services.validation import resolve_download_dir, validate_url
router = APIRouter()
@router.post("/api/download")
def download(req: DownloadRequest) -> dict[str, Any]:
    if not SERVER_DOWNLOADS_ENABLED: raise HTTPException(status_code=501, detail="Managed downloads are disabled in Vercel/serverless mode. Copy the generated command and run it locally, or set YTDLP_STUDIO_ALLOW_SERVER_DOWNLOADS=1 for a private experiment.")
    req.url = validate_url(req.url); req.playlist_items = [validate_url(u) for u in req.playlist_items]; resolve_download_dir(req.download_dir)
    job_id = uuid.uuid4().hex[:12]; native_playlist = req.playlist_download_mode == "native"
    set_job(job_id, status="queued", phase="queued", percent=0, created_at=time.time(), paused=False, cancel_requested=False, total_items=1 if native_playlist else len(req.playlist_items or [req.url]))
    threading.Thread(target=download_worker, args=(job_id, req), daemon=True).start()
    return {"job_id": job_id}
@router.get("/api/jobs/{job_id}")
def job(job_id: str) -> dict[str, Any]: return get_job(job_id)
@router.post("/api/jobs/{job_id}/pause")
def pause(job_id: str) -> dict[str, Any]:
    data = get_job(job_id); pid = data.get("process_pid")
    if not pid: raise HTTPException(status_code=400, detail="No running process to pause.")
    suspend_process_tree(int(pid)); set_job(job_id, paused=True, status="paused"); return {"ok": True}
@router.post("/api/jobs/{job_id}/resume")
def resume(job_id: str) -> dict[str, Any]:
    data = get_job(job_id); pid = data.get("process_pid")
    if not pid: raise HTTPException(status_code=400, detail="No running process to resume.")
    resume_process_tree(int(pid)); set_job(job_id, paused=False, status="running"); return {"ok": True}
@router.post("/api/jobs/{job_id}/cancel")
def cancel(job_id: str) -> dict[str, Any]:
    data = get_job(job_id); pid = data.get("process_pid"); set_job(job_id, cancel_requested=True)
    if pid: terminate_process_tree(int(pid))
    set_job(job_id, status="cancelled", phase="cancelled", process=None); return {"ok": True}
