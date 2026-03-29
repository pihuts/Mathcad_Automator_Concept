"""Batch processing endpoints."""

from fastapi import APIRouter, HTTPException, Depends

from ..dependencies import get_engine_manager
from src.engine.manager import EngineManager
from ..schemas import BatchRequest, BatchStatus, ControlResponse

router = APIRouter()


@router.post("/batch/start", response_model=ControlResponse)
async def start_batch(
    req: BatchRequest,
    manager: EngineManager = Depends(get_engine_manager),
):
    """Start a batch processing operation."""
    if not manager.is_running():
        raise HTTPException(status_code=503, detail="Engine is not running")

    manager.batch_manager.start_batch(
        req.batch_id,
        req.inputs,
        req.output_dir,
        export_pdf=req.export_pdf,
        export_mcdx=req.export_mcdx,
        mode=req.mode,
        output_units=req.output_units,
        overwrite_existing=req.overwrite_existing,
        output_dir_mode=req.output_dir_mode,
        source_file_path=req.source_file_path,
    )
    return ControlResponse(
        status="started",
        message=f"Batch {req.batch_id} initiated with {req.mode} mode",
    )


@router.get("/batch/{batch_id}", response_model=BatchStatus)
async def get_batch_status(
    batch_id: str,
    manager: EngineManager = Depends(get_engine_manager),
):
    """Get status of a batch operation by ID."""
    status = manager.batch_manager.get_status(batch_id)
    if not status:
        raise HTTPException(status_code=404, detail=f"Batch {batch_id} not found")
    return status


@router.post("/batch/{batch_id}/stop", response_model=ControlResponse)
async def stop_batch(
    batch_id: str,
    manager: EngineManager = Depends(get_engine_manager),
):
    """Stop a running batch operation."""
    manager.batch_manager.stop_batch(batch_id)
    return ControlResponse(
        status="stopped",
        message=f"Batch {batch_id} stopping signal sent",
    )
