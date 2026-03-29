"""Job submission and retrieval endpoints."""

import logging

from fastapi import APIRouter, HTTPException, Depends

from ..dependencies import get_engine_manager
from src.engine.manager import EngineManager
from ..schemas import JobSubmission, JobResponse

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/jobs", response_model=JobResponse)
async def submit_job(
    job: JobSubmission,
    manager: EngineManager = Depends(get_engine_manager),
):
    """Submit a job for execution."""
    if not manager.is_running():
        raise HTTPException(status_code=503, detail="Engine is not running")

    try:
        job_id = manager.submit_job(job.command, job.payload)
        return JobResponse(job_id=job_id)
    except Exception:
        logger.exception("Failed to submit job '%s'", job.command)
        raise HTTPException(status_code=500, detail="Failed to submit job")


@router.get("/jobs/{job_id}")
async def get_job_result(
    job_id: str,
    manager: EngineManager = Depends(get_engine_manager),
):
    """Get job result by ID."""
    result = manager.get_job(job_id)
    if not result:
        raise HTTPException(status_code=404, detail="Job result not found or pending")
    return result
