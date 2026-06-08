from __future__ import annotations
import os, re
from pathlib import Path
from fastapi import HTTPException
from app.core.config import DEFAULT_DOWNLOAD_DIR, IS_VERCEL, ROOT_DIR

def validate_url(url: str) -> str:
    value = url.strip()
    if not (value.startswith("http://") or value.startswith("https://")):
        raise HTTPException(status_code=400, detail="Paste a full http:// or https:// URL. This UI intentionally blocks file:, ftp:, shell-like, and extractor pseudo-URLs.")
    if any(ch in value for ch in "\r\n\t"):
        raise HTTPException(status_code=400, detail="URL contains invalid whitespace.")
    return value

def safe_output_template(template: str) -> str:
    template = template.strip() or "%(title).180B.%(ext)s"
    template = template.replace("\\", "/")
    if template.startswith("/") or re.match(r"^[A-Za-z]:/", template):
        raise HTTPException(status_code=400, detail="Output template must be relative to the download directory, not an absolute path.")
    parts = [part for part in template.split("/") if part not in {"", "."}]
    if any(part == ".." for part in parts):
        raise HTTPException(status_code=400, detail="Output template cannot contain .. parent folders.")
    return "/".join(parts) or "%(title).180B.%(ext)s"

def safe_playlist_items_spec(value: str | None) -> str | None:
    if not value: return None
    spec = value.strip()
    if not spec: return None
    if not re.fullmatch(r"[-0-9,:\s]+", spec):
        raise HTTPException(status_code=400, detail="Playlist item range may only contain numbers, commas, colons, dashes, and spaces. Example: 1:10,15,-3::1")
    return re.sub(r"\s+", "", spec)

def resolve_download_dir(path: str | None) -> Path:
    if IS_VERCEL and not path:
        target = DEFAULT_DOWNLOAD_DIR
    elif not path or not path.strip():
        target = DEFAULT_DOWNLOAD_DIR
    else:
        expanded = Path(os.path.expandvars(os.path.expanduser(path.strip())))
        target = expanded if expanded.is_absolute() else (ROOT_DIR / expanded)
    try:
        target.mkdir(parents=True, exist_ok=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not create download directory: {exc}") from exc
    return target.resolve()
