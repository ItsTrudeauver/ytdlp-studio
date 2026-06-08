from __future__ import annotations
from typing import Any
from fastapi import APIRouter
from app.models.schemas import CommandRequest, FilenamePreviewRequest
from app.services.commands import command_preview, filename_preview as filename_preview_service
router = APIRouter()
@router.post("/api/command")
def command(req: CommandRequest) -> dict[str, Any]: return command_preview(req)
@router.post("/api/filename-preview")
def filename_preview(req: FilenamePreviewRequest) -> dict[str, Any]: return filename_preview_service(req)
