from __future__ import annotations
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from app.core.config import STATIC_DIR
from app.routes import analyze, commands, directories, downloads, health
app = FastAPI(title="yt-dlp Studio", description="A browser UI for yt-dlp previews, commands, playlists, subtitles, cookies, and managed local downloads.", version="0.4.1")
app.include_router(health.router); app.include_router(analyze.router); app.include_router(commands.router); app.include_router(downloads.router); app.include_router(directories.router)
@app.get("/")
def index() -> FileResponse: return FileResponse(STATIC_DIR / "index.html")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
