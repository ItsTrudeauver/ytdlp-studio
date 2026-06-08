from __future__ import annotations
from typing import Literal, Dict, Any, List, Optional
from pydantic import BaseModel, Field

SubtitleMode = Literal["none", "manual", "auto", "both"]
ConvertSubtitles = Literal["none", "srt", "vtt", "ass", "lrc"]
PlaylistDownloadMode = Literal["queue", "native"]
ConcatPlaylist = Literal["never", "multi_video", "always"]
CookieSource = Literal["none", "chrome", "edge", "firefox", "brave", "cookies_txt"]
TargetOS = Literal["windows", "macos", "linux"]
JobStatus = Literal["pending", "running", "completed", "failed"]

# --- CORE REQUEST OPTIONS ---
class RequestOptions(BaseModel):
    url: str
    format_selector: str
    merge_output_format: str = "auto"
    output_template: str = "%(title).180B.%(ext)s"
    download_dir: str = ""
    playlist_items: List[str] = Field(default_factory=list)
    playlist_download_mode: PlaylistDownloadMode = "native"
    playlist_items_spec: str = ""
    concat_playlist: ConcatPlaylist = "never"
    concat_output_template: str = "%(playlist)s - combined.%(ext)s"
    subtitles_mode: SubtitleMode = "none"
    subtitle_languages: str = "en"
    subtitle_format: str = "best"
    convert_subtitles: ConvertSubtitles = "none"
    embed_subtitles: bool = False
    keep_subtitle_files: bool = False
    exclude_live_chat: bool = True
    subtitles_only: bool = False
    use_download_archive: bool = False
    download_archive_file: str = ""
    cookie_source: CookieSource = "none"
    cookies_file: str = ""
    restrict_filenames: bool = False
    write_info_json: bool = False
    write_description: bool = False
    write_thumbnail: bool = False
    embed_thumbnail: bool = False
    embed_metadata: bool = False
    embed_chapters: bool = False

# --- ANALYZE SCHEMAS ---
class AnalyzeRequest(BaseModel):
    url: str = Field(..., min_length=4)
    playlist_mode: bool = False
    playlist_limit: int = Field(50, ge=1, le=300)

# --- NEW CROSS-PLATFORM COMMAND SCHEMAS ---
class CommandRequest(BaseModel):
    options: RequestOptions
    target_os: TargetOS = "linux"

class CommandResponse(BaseModel):
    command: str

class FilenamePreviewRequest(BaseModel):
    options: RequestOptions

class FilenamePreviewResponse(BaseModel):
    filenames: List[str]
    note: Optional[str] = None

# --- RESTORED DIRECTORY SCHEMAS ---
class DirectoryRequest(BaseModel):
    path: str = ""

class DirectoryResponse(BaseModel):
    exists: bool
    is_absolute: bool
    resolved_path: str
    can_write: bool
    error: Optional[str] = None

# --- RESTORED DOWNLOADS & JOBS SCHEMAS ---
class DownloadRequest(BaseModel):
    options: RequestOptions

class DownloadResponse(BaseModel):
    job_id: str
    message: str

class JobLogEntry(BaseModel):
    timestamp: float
    message: str
    stream: str

class JobResponse(BaseModel):
    job_id: str
    url: str
    status: JobStatus
    created_at: float
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    error: Optional[str] = None
    progress: Dict[str, Any] = Field(default_factory=dict)
    logs: List[JobLogEntry] = Field(default_factory=list)