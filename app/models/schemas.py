from __future__ import annotations
from typing import Literal
from pydantic import BaseModel, Field
SubtitleMode = Literal["none", "manual", "auto", "both"]
ConvertSubtitles = Literal["none", "srt", "vtt", "ass", "lrc"]
PlaylistDownloadMode = Literal["queue", "native"]
ConcatPlaylist = Literal["never", "multi_video", "always"]
CookieSource = Literal["none", "chrome", "edge", "firefox", "brave", "cookies_txt"]
class AnalyzeRequest(BaseModel):
    url: str = Field(..., min_length=4)
    playlist_mode: bool = False
    playlist_limit: int = Field(50, ge=1, le=300)
class RequestOptions(BaseModel):
    url: str = Field(..., min_length=4)
    format_selector: str = "bv*+ba/b"
    merge_output_format: Literal["auto", "mp4", "mkv"] = "auto"
    output_template: str = "%(title).180B.%(ext)s"
    download_dir: str | None = None
    playlist_items: list[str] = Field(default_factory=list)
    playlist_download_mode: PlaylistDownloadMode = "queue"
    playlist_items_spec: str | None = None
    concat_playlist: ConcatPlaylist = "never"
    concat_output_template: str = "%(playlist)s - combined.%(ext)s"
    subtitles_mode: SubtitleMode = "none"
    subtitle_languages: str = "en"
    subtitle_format: str = "best"
    convert_subtitles: ConvertSubtitles = "none"
    embed_subtitles: bool = False
    keep_subtitle_files: bool = True
    exclude_live_chat: bool = True
    subtitles_only: bool = False
    use_download_archive: bool = False
    cookie_source: CookieSource = "none"
    cookies_file: str | None = None
    restrict_filenames: bool = False
    write_info_json: bool = False
    write_description: bool = False
    write_thumbnail: bool = False
    embed_thumbnail: bool = False
    embed_metadata: bool = False
    embed_chapters: bool = False
class DownloadRequest(RequestOptions): pass
class CommandRequest(RequestOptions): pass
class FilenamePreviewRequest(RequestOptions):
    preview_limit: int = Field(12, ge=1, le=40)
class DirectoryRequest(BaseModel):
    path: str | None = None
