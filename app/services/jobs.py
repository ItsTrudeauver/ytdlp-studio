from __future__ import annotations
import os, re, subprocess, threading, time, traceback
from typing import Any
import psutil
from fastapi import HTTPException
from app.models.schemas import DownloadRequest
from app.services.commands import quote_command, ytdlp_subprocess_parts
from app.services.validation import resolve_download_dir, validate_url
jobs_lock = threading.Lock(); jobs: dict[str, dict[str, Any]] = {}
PROGRESS_RE = re.compile(r"\[download\]\s+(?P<pct>\d+(?:\.\d+)?)%.*?(?:of\s+~?\s*(?P<total>\S+))?.*?(?:at\s+(?P<speed>\S+))?.*?(?:ETA\s+(?P<eta>\S+))?", re.IGNORECASE)
def set_job(job_id: str, **updates: Any) -> None:
    with jobs_lock:
        job = jobs.setdefault(job_id, {}); job.update(updates); job["updated_at"] = time.time()
def get_job(job_id: str) -> dict[str, Any]:
    with jobs_lock:
        job = jobs.get(job_id)
        if not job: raise HTTPException(status_code=404, detail="Unknown job id.")
        return dict({k: v for k, v in job.items() if k not in {"process"}})
def process_tree(pid: int) -> list[psutil.Process]:
    try:
        parent = psutil.Process(pid); return parent.children(recursive=True) + [parent]
    except psutil.Error: return []
def suspend_process_tree(pid: int) -> None:
    for proc in process_tree(pid):
        try: proc.suspend()
        except psutil.Error: pass
def resume_process_tree(pid: int) -> None:
    for proc in process_tree(pid):
        try: proc.resume()
        except psutil.Error: pass
def terminate_process_tree(pid: int) -> None:
    procs = process_tree(pid)
    for proc in procs:
        try: proc.terminate()
        except psutil.Error: pass
    _, alive = psutil.wait_procs(procs, timeout=3)
    for proc in alive:
        try: proc.kill()
        except psutil.Error: pass
def parse_progress(line: str) -> dict[str, Any]:
    match = PROGRESS_RE.search(line)
    if not match: return {}
    pct = match.group("pct")
    return {"percent": float(pct) if pct is not None else None, "total_text": match.group("total"), "speed_text": match.group("speed"), "eta_text": match.group("eta")}
def run_one(job_id: str, req: DownloadRequest, url: str, number: int, total: int) -> int:
    parts = ytdlp_subprocess_parts(req, url)
    set_job(job_id, status="running", phase="download", current_index=number, total_items=total, current_url=url, command=quote_command(["yt-dlp", *parts[3:]]), log_tail=[], percent=0)
    creationflags = 0; preexec_fn = None
    if os.name == "nt": creationflags = subprocess.CREATE_NEW_PROCESS_GROUP  # type: ignore[attr-defined]
    else: preexec_fn = os.setsid
    proc = subprocess.Popen(parts, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace", bufsize=1, creationflags=creationflags, preexec_fn=preexec_fn)
    set_job(job_id, process=proc, process_pid=proc.pid, paused=False)
    assert proc.stdout is not None
    for raw_line in proc.stdout:
        line = raw_line.rstrip(); public = get_job(job_id)
        if public.get("cancel_requested"):
            terminate_process_tree(proc.pid); break
        progress = parse_progress(line)
        with jobs_lock:
            job = jobs.setdefault(job_id, {}); tail = list(job.get("log_tail") or []); tail.append(line); del tail[:-100]
            job["log_tail"] = tail; job["updated_at"] = time.time()
            if progress:
                job.update(progress); job["status"] = "paused" if job.get("paused") else "running"; job["phase"] = "download"
            elif "Merging formats" in line or "Merger" in line or "Concat" in line or "Deleting original file" in line:
                job["phase"] = "postprocess"
            elif "Destination:" in line:
                job["filename"] = line.split("Destination:", 1)[-1].strip()
    return proc.wait()
def download_worker(job_id: str, req: DownloadRequest) -> None:
    native_playlist = req.playlist_download_mode == "native"
    urls = [validate_url(req.url)] if native_playlist else [validate_url(u) for u in (req.playlist_items or [req.url])]
    total = 1 if native_playlist else len(urls)
    try:
        resolve_download_dir(req.download_dir)
        for i, url in enumerate(urls, start=1):
            public = get_job(job_id)
            if public.get("cancel_requested"):
                set_job(job_id, status="cancelled", phase="cancelled", process=None); return
            code = run_one(job_id, req, url, i, total)
            if code != 0:
                public = get_job(job_id)
                if public.get("cancel_requested"):
                    set_job(job_id, status="cancelled", phase="cancelled", process=None); return
                raise RuntimeError(f"yt-dlp exited with code {code}")
        set_job(job_id, status="finished", phase="done", percent=100, process=None, paused=False)
    except Exception as exc:
        set_job(job_id, status="error", phase="error", error=f"{exc}", traceback=traceback.format_exc(), process=None, paused=False)
