from __future__ import annotations
import os, subprocess, sys
from typing import Any
from fastapi import HTTPException
from app.core.config import IS_VERCEL
from app.models.schemas import CommandRequest, FilenamePreviewRequest, RequestOptions
from app.services.validation import resolve_download_dir, safe_output_template, safe_playlist_items_spec, validate_url

def shell_quote_posix(value: str) -> str: return "'" + value.replace("'", "'\\''") + "'"
def quote_command(parts: list[str]) -> str:
    if os.name == "nt": return subprocess.list2cmdline(parts)
    return " ".join(shell_quote_posix(p) if any(ch.isspace() or ch in "'\"[]()&;|<>" for ch in p) else p for p in parts)

def normalize_sub_languages(req: RequestOptions) -> str:
    langs = (req.subtitle_languages or "en").strip().replace(" ", "") or "en"
    if req.exclude_live_chat and "live_chat" not in langs: langs = f"{langs},-live_chat"
    return langs

def add_subtitle_args(parts: list[str], req: RequestOptions) -> None:
    want_subs = req.subtitles_mode != "none" or req.embed_subtitles or req.subtitles_only
    if req.subtitles_only: parts.append("--skip-download")
    if not want_subs: return
    mode = req.subtitles_mode
    if mode in {"manual", "both"} or (req.subtitles_only and mode == "none"): parts.append("--write-subs")
    if mode in {"auto", "both"}: parts.append("--write-auto-subs")
    if req.embed_subtitles:
        parts.append("--embed-subs")
        if not req.keep_subtitle_files: parts += ["--compat-options", "no-keep-subs"]
    if req.subtitle_format.strip(): parts += ["--sub-format", req.subtitle_format.strip()]
    parts += ["--sub-langs", normalize_sub_languages(req)]
    if req.convert_subtitles != "none": parts += ["--convert-subs", req.convert_subtitles]

def add_cookie_args(parts: list[str], req: RequestOptions, *, for_download: bool = False) -> None:
    source = req.cookie_source or "none"
    if source == "none": return
    if IS_VERCEL and for_download: raise HTTPException(status_code=400, detail="Cookies are local-only. Use the generated command on your own machine instead of uploading cookies to Vercel/serverless mode.")
    if source == "cookies_txt":
        if not req.cookies_file or not req.cookies_file.strip(): raise HTTPException(status_code=400, detail="Choose a cookies.txt path or set Cookies to None.")
        parts += ["--cookies", os.path.expandvars(os.path.expanduser(req.cookies_file.strip()))]
    else: parts += ["--cookies-from-browser", source]

def add_metadata_args(parts: list[str], req: RequestOptions) -> None:
    if req.restrict_filenames: parts.append("--restrict-filenames")
    if req.write_info_json: parts.append("--write-info-json")
    if req.write_description: parts.append("--write-description")
    if req.write_thumbnail or req.embed_thumbnail: parts.append("--write-thumbnail")
    if req.embed_thumbnail: parts.append("--embed-thumbnail")
    if req.embed_metadata: parts.append("--embed-metadata")
    if req.embed_chapters: parts.append("--embed-chapters")

def ytdlp_parts(req: RequestOptions, url: str, *, python_module: bool) -> list[str]:
    out_dir = resolve_download_dir(req.download_dir)
    outtmpl = str(out_dir / safe_output_template(req.output_template))
    parts = [sys.executable, "-m", "yt_dlp"] if python_module else ["yt-dlp"]
    parts += ["--continue", "--newline"]
    native_playlist = req.playlist_download_mode == "native"
    if native_playlist:
        parts.append("--yes-playlist")
        spec = safe_playlist_items_spec(req.playlist_items_spec)
        if spec: parts += ["-I", spec]
        parts += ["--concat-playlist", req.concat_playlist]
    else:
        parts.append("--no-playlist")
        if req.concat_playlist != "never": raise HTTPException(status_code=400, detail="Combine into one long video requires Native playlist mode, not selected-queue mode.")
    if not req.subtitles_only: parts += ["-f", req.format_selector.strip() or "bv*+ba/b"]
    if req.merge_output_format != "auto" and not req.subtitles_only: parts += ["--merge-output-format", req.merge_output_format]
    add_subtitle_args(parts, req); add_cookie_args(parts, req, for_download=python_module); add_metadata_args(parts, req)
    if req.use_download_archive: parts += ["--download-archive", str(out_dir / "yt-dlp-studio-archive.txt")]
    parts += ["-o", outtmpl]
    if native_playlist and req.concat_playlist != "never": parts += ["-o", f"pl_video:{str(out_dir / safe_output_template(req.concat_output_template))}"]
    parts.append(url)
    return parts

def ytdlp_display_parts(req: CommandRequest, url: str) -> list[str]: return ytdlp_parts(req, url, python_module=False)
def ytdlp_subprocess_parts(req: RequestOptions, url: str) -> list[str]: return ytdlp_parts(req, url, python_module=True)

def command_preview(req: CommandRequest) -> dict[str, Any]:
    req.url = validate_url(req.url)
    native_playlist = req.playlist_download_mode == "native"
    urls = [req.url] if native_playlist else [validate_url(u) for u in (req.playlist_items or [req.url])]
    commands = [quote_command(ytdlp_display_parts(req, url)) for url in urls]
    shown = commands[:50]; omitted = max(0, len(commands) - len(shown)); text = "\n".join(shown)
    if omitted: text += f"\n# … {omitted} more command(s) omitted from preview. The Download button still queues all selected items."
    if IS_VERCEL: text += "\n# Vercel mode note: copy this command and run it locally for real downloads/ffmpeg work."
    return {"command": text, "count": len(commands), "omitted": omitted, "serverless": IS_VERCEL}

def preview_command_parts(req: FilenamePreviewRequest, url: str, *, native_playlist: bool) -> list[str]:
    original_mode = req.playlist_download_mode
    try:
        req.playlist_download_mode = "native" if native_playlist else "queue"; parts = ytdlp_parts(req, url, python_module=True)
    finally: req.playlist_download_mode = original_mode
    cleaned: list[str] = []; skip_next = False
    for part in parts:
        if skip_next: skip_next = False; continue
        if part in {"--download-archive", "--continue", "--newline", "--concat-playlist"}:
            skip_next = part in {"--download-archive", "--concat-playlist"}; continue
        cleaned.append(part)
    if cleaned and cleaned[-1] == url: cleaned = cleaned[:-1] + ["--skip-download", "--print", "filename"] + cleaned[-1:]
    else: cleaned += ["--skip-download", "--print", "filename", url]
    if native_playlist: cleaned = cleaned[:-1] + ["--playlist-end", str(req.preview_limit)] + cleaned[-1:]
    return cleaned

def run_filename_preview(req: FilenamePreviewRequest, urls: list[str], *, native_playlist: bool) -> list[str]:
    filenames: list[str] = []
    for url in urls:
        parts = preview_command_parts(req, url, native_playlist=native_playlist)
        try: proc = subprocess.run(parts, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace", timeout=90, check=False)
        except subprocess.TimeoutExpired as exc: raise HTTPException(status_code=408, detail="Filename preview timed out. Try a smaller playlist preview limit.") from exc
        lines = [line.strip() for line in proc.stdout.splitlines() if line.strip()]
        plausible = [line for line in lines if not line.startswith("[") and not line.lower().startswith(("warning:", "error:"))]
        if proc.returncode != 0 and not plausible:
            detail = "\n".join(lines[-8:]) or f"yt-dlp exited with code {proc.returncode}"; raise HTTPException(status_code=400, detail=detail)
        filenames.extend(plausible[: req.preview_limit - len(filenames)])
        if len(filenames) >= req.preview_limit: break
    return filenames

def filename_preview(req: FilenamePreviewRequest) -> dict[str, Any]:
    req.url = validate_url(req.url); native_playlist = req.playlist_download_mode == "native"
    urls = [req.url] if native_playlist else [validate_url(u) for u in (req.playlist_items or [req.url])]
    urls = urls[: req.preview_limit]
    if IS_VERCEL and req.cookie_source != "none": return {"filenames": [], "note": "Cookie-based filename preview is local-only. Copy the generated command and run it locally.", "serverless": True}
    filenames = run_filename_preview(req, urls, native_playlist=native_playlist)
    return {"filenames": filenames, "count": len(filenames), "limit": req.preview_limit, "native_playlist": native_playlist, "note": "Preview uses yt-dlp --print filename without downloading. Final extensions can still change after merge/post-processing.", "serverless": IS_VERCEL}
