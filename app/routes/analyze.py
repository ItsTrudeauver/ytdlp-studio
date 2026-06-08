from __future__ import annotations
from typing import Any
from fastapi import APIRouter
from app.models.schemas import AnalyzeRequest
from app.services.ytdlp_probe import analyze_url
router = APIRouter()
@router.post("/api/analyze")
def analyze(req: AnalyzeRequest) -> dict[str, Any]: return analyze_url(req)
