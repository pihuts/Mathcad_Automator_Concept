"""File operations endpoints - browse, open, and analyze files."""

import asyncio
import logging
from pathlib import Path
from typing import Dict, Any

from fastapi import APIRouter, HTTPException, Depends

from ..dependencies import get_engine_manager
from ..services.file_service import FileService
from src.engine.manager import EngineManager

router = APIRouter()
logger = logging.getLogger(__name__)

# Service instance for file operations
_file_service = FileService()


def _resolve_client_path(raw_path: str) -> Path:
    """Resolve client path and reject parent traversal segments."""
    path_obj = Path(raw_path)
    if any(part == ".." for part in path_obj.parts):
        raise HTTPException(status_code=400, detail="Path must not contain '..' traversal segments")

    if path_obj.is_absolute():
        return path_obj.resolve()
    return (Path.cwd() / path_obj).resolve()


@router.post("/files/browse")
async def browse_for_file():
    """
    Open native file dialog and return selected path.

    Uses a subprocess to run the tkinter dialog, avoiding asyncio threading issues.

    Returns:
        - file_path: Selected file path or None if cancelled
        - cancelled: True if user cancelled the dialog
    """
    try:
        file_path = await asyncio.to_thread(_file_service.browse_file)
        if not file_path:
            return {"file_path": None, "cancelled": True}
        return {"file_path": file_path, "cancelled": False}
    except Exception as e:
        logger.exception("File dialog error")
        raise HTTPException(status_code=500, detail=f"File dialog error: {str(e)}")


@router.post("/files/open")
async def open_file_natively(payload: Dict[str, Any]):
    """
    Open a file using the system default application.

    Args:
        payload: Must contain 'path' key with the file path to open.

    Returns:
        - status: "success" if file opened successfully

    Raises:
        400: Invalid or missing path
        500: Error opening file
    """
    path = payload.get("path")
    if not path:
        raise HTTPException(status_code=400, detail="Missing 'path' in payload")

    try:
        safe_path = _resolve_client_path(path)
        result = _file_service.open_file(str(safe_path))
        if result.get("status") == "error":
            raise HTTPException(status_code=500, detail=result.get("error", "Unknown error"))
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/settings/folder-picker")
async def browse_for_folder():
    """
    Open native folder picker dialog.

    Uses a subprocess to run the tkinter dialog, avoiding asyncio threading issues.

    Returns:
        - path: Selected folder path or None if cancelled
        - cancelled: True if user cancelled the dialog
    """
    try:
        folder_path = await asyncio.to_thread(_file_service.browse_folder)
        if not folder_path:
            return {"path": None, "cancelled": True}
        return {"path": folder_path, "cancelled": False}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/engine/analyze")
async def analyze_file(
    payload: Dict[str, Any],
    manager: EngineManager = Depends(get_engine_manager),
):
    """
    Analyze a Mathcad file to extract input/output metadata.

    This endpoint submits a job to the engine to retrieve metadata from
    the specified Mathcad file, including input variables and output regions.

    Args:
        payload: Must contain 'path' key with the file path to analyze.

    Returns:
        Metadata about the file including inputs and outputs.

    Raises:
        400: Missing 'path' in payload
        503: Engine is not running
        500: Analysis failed
        504: Analysis timed out
    """
    import time

    if not manager.is_running():
        raise HTTPException(status_code=503, detail="Engine is not running")

    path = payload.get("path")
    if not path:
        raise HTTPException(status_code=400, detail="Missing 'path' in payload")
    safe_path = _resolve_client_path(path)
    if safe_path.suffix.lower() != ".mcdx":
        raise HTTPException(status_code=400, detail="Only .mcdx files can be analyzed")
    if not safe_path.exists() or not safe_path.is_file():
        raise HTTPException(status_code=400, detail=f"File not found: {safe_path}")

    try:
        print(f"[analyze] Submitting get_metadata for path: {safe_path}")
        job_id = manager.submit_job("get_metadata", {"path": str(safe_path)})
        print(f"[analyze] Job submitted: {job_id}. Waiting for result...")

        # Use event-based wait instead of polling (max 600 seconds = 10 minutes - Mathcad launch and file analysis can be slow)
        result = manager.wait_for_result(job_id, timeout=600.0)
        if result is None:
            print(f"[analyze] Job {job_id} TIMED OUT after 600s")
            raise HTTPException(status_code=504, detail="Analysis timed out (Mathcad took too long to respond)")

        if result.status == "success":
            print(f"[analyze] Job {job_id} succeeded")
            return result.data
        else:
            msg = result.error_message or "Unknown error"
            print(f"[analyze] Job {job_id} FAILED: {msg}")
            if "No worksheet open" in msg or "Mathcad not connected" in msg:
                msg += " (Ensure Mathcad Prime is installed and the file path is correct)"
            raise HTTPException(status_code=500, detail=msg)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
