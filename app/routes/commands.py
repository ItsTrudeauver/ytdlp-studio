from __future__ import annotations
from typing import Any
from fastapi import APIRouter
from app.models.schemas import CommandRequest, CommandResponse, FilenamePreviewRequest, FilenamePreviewResponse
from app.services.commands import command_preview, filename_preview

router = APIRouter()

@router.post("/preview", response_model=CommandResponse)
async def get_command_preview(payload: CommandRequest) -> Any:
    cmd_str = command_preview(payload.options, target_os=payload.target_os)
    return CommandResponse(command=cmd_str)

@router.post("/filenames", response_model=FilenamePreviewResponse)
async def get_filename_preview(payload: FilenamePreviewRequest) -> Any:
    lines, note = filename_preview(payload.options)
    return FilenamePreviewResponse(filenames=lines, note=note)