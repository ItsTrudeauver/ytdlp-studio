from __future__ import annotations
import re
from typing import Any

def size_of(format_info: dict[str, Any]) -> int | None:
    return format_info.get("filesize") or format_info.get("filesize_approx")

def duration_string(seconds: Any) -> str | None:
    try: seconds = int(seconds)
    except (TypeError, ValueError): return None
    h, rem = divmod(seconds, 3600); m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"

def compact_format(fmt: dict[str, Any]) -> dict[str, Any]:
    vcodec = fmt.get("vcodec") or "none"; acodec = fmt.get("acodec") or "none"
    has_video = vcodec != "none"; has_audio = acodec != "none"; size = size_of(fmt)
    return {"format_id": fmt.get("format_id"), "format_note": fmt.get("format_note"), "ext": fmt.get("ext"), "protocol": fmt.get("protocol"), "resolution": fmt.get("resolution"), "width": fmt.get("width"), "height": fmt.get("height"), "fps": fmt.get("fps"), "tbr": fmt.get("tbr"), "vbr": fmt.get("vbr"), "abr": fmt.get("abr"), "asr": fmt.get("asr"), "vcodec": vcodec, "acodec": acodec, "dynamic_range": fmt.get("dynamic_range"), "filesize": fmt.get("filesize"), "filesize_approx": fmt.get("filesize_approx"), "size": size, "has_video": has_video, "has_audio": has_audio, "is_audio_only": has_audio and not has_video, "is_video_only": has_video and not has_audio, "is_combined": has_video and has_audio}

def entry_url(entry: dict[str, Any]) -> str | None:
    url = entry.get("webpage_url") or entry.get("original_url")
    if url: return url
    video_id = entry.get("id")
    if video_id and entry.get("extractor_key") == "Youtube": return f"https://www.youtube.com/watch?v={video_id}"
    if video_id and re.match(r"^[A-Za-z0-9_-]{8,}$", str(video_id)): return f"https://www.youtube.com/watch?v={video_id}"
    return entry.get("url")

def compact_video_info(info: dict[str, Any], playlist_index: int | None = None) -> dict[str, Any]:
    formats = [compact_format(fmt) for fmt in info.get("formats", []) if fmt.get("format_id")]
    subtitles = sorted((info.get("subtitles") or {}).keys()); automatic_captions = sorted((info.get("automatic_captions") or {}).keys())
    return {"id": info.get("id"), "playlist_index": playlist_index or info.get("playlist_index"), "title": info.get("title") or "Untitled", "uploader": info.get("uploader"), "channel": info.get("channel"), "channel_follower_count": info.get("channel_follower_count"), "view_count": info.get("view_count"), "duration": info.get("duration"), "duration_string": info.get("duration_string") or duration_string(info.get("duration")), "webpage_url": entry_url(info), "thumbnail": info.get("thumbnail"), "upload_date": info.get("upload_date"), "timestamp": info.get("timestamp"), "formats": formats, "format_count": len(formats), "subtitles": subtitles, "automatic_captions": automatic_captions}
