from __future__ import annotations
from typing import Any
from fastapi import HTTPException
from app.models.schemas import AnalyzeRequest
from app.services.media_info import compact_video_info
from app.services.validation import validate_url
try:
    from yt_dlp import YoutubeDL
except Exception:
    YoutubeDL = None  # type: ignore[assignment]

def analyze_url(req: AnalyzeRequest) -> dict[str, Any]:
    url = validate_url(req.url)
    opts: dict[str, Any] = {"quiet": True, "skip_download": True, "noplaylist": not req.playlist_mode, "extract_flat": False, "ignoreerrors": True}
    if req.playlist_mode: opts["playlistend"] = req.playlist_limit
    if YoutubeDL is None: raise HTTPException(status_code=500, detail="yt-dlp is not installed. Run pip install -r requirements.txt first.")
    try:
        with YoutubeDL(opts) as ydl: info = ydl.extract_info(url, download=False)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not info: raise HTTPException(status_code=400, detail="yt-dlp did not return metadata for that URL.")
    entries = info.get("entries")
    if req.playlist_mode and entries:
        items = [compact_video_info(entry, playlist_index=entry.get("playlist_index") or idx) for idx, entry in enumerate([e for e in entries if e], start=1)]
        first = items[0] if items else None
        return {"kind": "playlist", "id": info.get("id"), "title": info.get("title") or "Playlist", "uploader": info.get("uploader") or info.get("channel"), "webpage_url": info.get("webpage_url") or url, "playlist_count": info.get("playlist_count") or len(items), "playlist_limit": req.playlist_limit, "items": items, "current": first, "formats": first.get("formats", []) if first else []}
    video = compact_video_info(info)
    return {"kind": "video", **video, "formats": video["formats"], "current": video, "items": []}
