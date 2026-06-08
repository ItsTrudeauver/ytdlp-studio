from __future__ import annotations
import os
import subprocess
import shlex
from typing import List, Tuple, Optional
from fastapi import HTTPException
from app.core.config import IS_VERCEL
from app.models.schemas import RequestOptions
from app.services.validation import resolve_download_dir, safe_output_template, safe_playlist_items_spec, validate_url

def escape_shell_arg(value: str, target_os: str = "linux") -> str:
    """Escapes strings based on target OS to prevent malformed terminal commands."""
    if target_os == "windows":
        special_chars = set('&<>()^|=;`, ')
        if any(ch in special_chars for ch in value) or not value:
            safe = value.replace('"', '""')
            return f'"{safe}"'
        return value
    else:
        return shlex.quote(value)

def normalize_sub_languages(req: RequestOptions) -> str:
    langs = (req.subtitle_languages or "en").strip().replace(" ", "") or "en"
    if req.exclude_live_chat and "live_chat" not in langs:
        langs = f"{langs}, -live_chat"
    return langs

def add_subtitle_args(parts: List[str], req: RequestOptions) -> None:
    want_subs = req.subtitles_mode != "none" or req.embed_subtitles or req.subtitles_only
    if req.subtitles_only:
        parts.append("--skip-download")
    if not want_subs:
        return
    mode = req.subtitles_mode
    if mode in {"manual", "both"} or (req.subtitles_only and mode == "none"):
        parts.append("--write-subs")
    if mode in {"auto", "both"}:
        parts.append("--write-auto-subs")
    if req.embed_subtitles:
        parts.append("--embed-subs")
        if not req.keep_subtitle_files:
            parts += ["--compat-options", "no-keep-subs"]
    if req.subtitle_format.strip():
        parts += ["--sub-format", req.subtitle_format.strip()]
    parts += ["--sub-langs", normalize_sub_languages(req)]
    if req.convert_subtitles != "none":
        parts += ["--convert-subs", req.convert_subtitles]

def add_cookie_args(parts: List[str], req: RequestOptions, *, for_download: bool = False) -> None:
    source = req.cookie_source or "none"
    if source == "none":
        return
    if IS_VERCEL and for_download:
        raise HTTPException(status_code=400, detail="Cookies are local-only. Use the generated command on your own machine.")
    if source == "cookies_txt":
        if not req.cookies_file or not req.cookies_file.strip():
            raise HTTPException(status_code=400, detail="Choose a cookies.txt path or set Cookies to None.")
        parts += ["--cookies", os.path.expandvars(os.path.expanduser(req.cookies_file.strip()))]
    else:
        parts += ["--cookies-from-browser", source]

def add_metadata_args(parts: List[str], req: RequestOptions) -> None:
    if req.restrict_filenames:
        parts.append("--restrict-filenames")
    if req.write_info_json:
        parts.append("--write-info-json")
    if req.write_description:
        parts.append("--write-description")
    if req.write_thumbnail:
        parts.append("--write-thumbnail")
    if req.embed_thumbnail:
        parts.append("--embed-thumbnail")
    if req.embed_metadata:
        parts.append("--embed-metadata")
    if req.embed_chapters:
        parts.append("--embed-chapters")

def build_base_args(req: RequestOptions, for_download: bool = False) -> List[str]:
    validate_url(req.url)
    parts = ["yt-dlp"]
    if req.format_selector.strip():
        parts += ["-f", req.format_selector.strip()]
    if req.merge_output_format != "auto":
        parts += ["--merge-output-format", req.merge_output_format]
    
    add_subtitle_args(parts, req)
    add_cookie_args(parts, req, for_download=for_download)
    add_metadata_args(parts, req)

    if req.use_download_archive:
        arch = (req.download_archive_file or "").strip()
        if arch:
            parts += ["--download-archive", os.path.expandvars(os.path.expanduser(arch))]

    return parts

def quote_command(parts: List[str]) -> str:
    """Internal runner for the subprocess queue to log safely"""
    return shlex.join(parts)

def ytdlp_subprocess_parts(req: RequestOptions) -> List[str]:
    """Builds raw unescaped array for internal Python execution via subprocess"""
    parts = build_base_args(req, for_download=True)
    out_tmpl = safe_output_template(req.output_template)
    dl_dir = resolve_download_dir(req.download_dir)
    
    parts += ["-P", str(dl_dir)]
    parts += ["-o", out_tmpl]

    if req.playlist_download_mode == "native":
        spec = safe_playlist_items_spec(req.playlist_items_spec)
        if spec:
            parts += ["--playlist-items", spec]
        if req.concat_playlist != "never":
            parts += ["--concat-playlist", req.concat_playlist]
            if req.concat_output_template.strip():
                parts += ["--concat-output-template", req.concat_output_template.strip()]
        parts.append(req.url)
    else:
        if req.playlist_items:
            for item_url in req.playlist_items:
                parts.append(item_url)
        else:
            parts.append(req.url)
    return parts

def command_preview(req: RequestOptions, target_os: str = "linux") -> str:
    """Builds string formatted explicitly for UI viewing across operating systems"""
    parts = build_base_args(req, for_download=False)
    
    out_tmpl = safe_output_template(req.output_template)
    dl_dir = req.download_dir.strip()
    
    if dl_dir:
        parts += ["-P", dl_dir]
            
    parts += ["-o", out_tmpl]

    if req.playlist_download_mode == "native":
        spec = safe_playlist_items_spec(req.playlist_items_spec)
        if spec:
            parts += ["--playlist-items", spec]
        if req.concat_playlist != "never":
            parts += ["--concat-playlist", req.concat_playlist]
            if req.concat_output_template.strip():
                parts += ["--concat-output-template", req.concat_output_template.strip()]
        parts.append(req.url)
    else:
        if req.playlist_items:
            for item_url in req.playlist_items:
                parts.append(item_url)
        else:
            parts.append(req.url)

    escaped_parts = [escape_shell_arg(p, target_os=target_os) for p in parts]
    
    if target_os == "windows":
        return " ^\n  ".join(escaped_parts)
    else:
        return " \\\n  ".join(escaped_parts)

def filename_preview(req: RequestOptions) -> Tuple[List[str], Optional[str]]:
    parts = ytdlp_subprocess_parts(req)
    parts.insert(1, "--print")
    parts.insert(2, "filename")
    parts.insert(3, "--simulate") 
    
    try:
        result = subprocess.run(parts, capture_output=True, text=True, check=True)
        filenames = [line.strip() for line in result.stdout.splitlines() if line.strip()]
        if not filenames:
             return [], "No filenames returned."
        return filenames, None
    except Exception as e:
        return [], f"Failed to simulate filenames. Ensure yt-dlp is installed locally if testing outside serverless. ({e})"