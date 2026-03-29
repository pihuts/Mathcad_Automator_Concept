"""Settings endpoints for application configuration."""

import asyncio
import os
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException

from ..schemas import OutputDirSettingsRequest, OutputDirSettingsResponse, OutputDirMode
from ..dependencies import get_engine_manager

router = APIRouter()


def _resolve_source_path(source_file_path: Optional[str]) -> str:
    """Resolve output directory for source mode."""
    if source_file_path:
        return str(Path(source_file_path).parent.resolve())
    return str(Path.cwd().resolve())


def _resolve_working_path() -> str:
    """Resolve output directory for working mode."""
    return str(Path.cwd().resolve())


def _open_folder_dialog():
    """Open native folder dialog - runs in separate thread."""
    from tkinter import Tk, filedialog

    root = Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    root.focus_force()

    folder_path = filedialog.askdirectory(title="Select Output Directory")

    root.destroy()
    return folder_path


@router.post("/settings/output-dir", response_model=OutputDirSettingsResponse)
async def validate_output_dir(req: OutputDirSettingsRequest):
    """Validate and resolve output directory based on mode."""
    try:
        if req.mode == OutputDirMode.working:
            resolved = _resolve_working_path()
            return OutputDirSettingsResponse(valid=True, resolved_path=resolved, mode=req.mode)

        elif req.mode == OutputDirMode.source:
            resolved = _resolve_source_path(req.source_file_path)
            return OutputDirSettingsResponse(valid=True, resolved_path=resolved, mode=req.mode)

        elif req.mode == OutputDirMode.custom:
            if not req.custom_path:
                return OutputDirSettingsResponse(
                    valid=False,
                    error="Custom path is required for custom mode",
                    mode=req.mode,
                )

            raw_path = Path(req.custom_path)
            path = raw_path.resolve() if raw_path.is_absolute() else (Path.cwd() / raw_path).resolve()
            if not path.exists():
                return OutputDirSettingsResponse(
                    valid=False,
                    error="Path does not exist",
                    mode=req.mode,
                )

            if not os.access(path, os.W_OK):
                return OutputDirSettingsResponse(
                    valid=False,
                    error="Path is not writable",
                    mode=req.mode,
                )

            return OutputDirSettingsResponse(
                valid=True,
                resolved_path=str(path),
                mode=req.mode,
            )

        return OutputDirSettingsResponse(valid=False, error="Invalid mode", mode=req.mode)
    except Exception as e:
        return OutputDirSettingsResponse(valid=False, error=str(e), mode=req.mode)


@router.get("/settings/folder-picker")
async def browse_for_folder():
    """Open native folder picker dialog."""
    try:
        folder_path = await asyncio.to_thread(_open_folder_dialog)
        if not folder_path:
            return {"path": None, "cancelled": True}
        return {"path": folder_path, "cancelled": False}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def get_operation_status():
    """
    Get current operation status for close confirmation.
    Returns whether any batch or workflow operation is in progress.
    """
    manager = get_engine_manager()

    # Check batch operations
    batch_running = False
    for batch_id, batch in manager.batch_manager.batches.items():
        if batch.get("status") == "running":
            batch_running = True
            break

    # Check workflow operations
    workflow_running = False
    for workflow_id, workflow in manager.workflow_manager.workflows.items():
        if workflow.get("status") == "running":
            workflow_running = True
            break

    return {
        "batch_running": batch_running,
        "workflow_running": workflow_running,
        "operation_in_progress": batch_running or workflow_running,
    }
