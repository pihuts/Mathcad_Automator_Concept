"""Workflow management endpoints."""

from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any
import time
import logging

from ..dependencies import get_engine_manager
from src.engine.manager import EngineManager
from src.engine.protocol import WorkflowConfig

router = APIRouter()
logger = logging.getLogger(__name__)


# Static paths must be defined BEFORE dynamic paths with {workflow_id}
# to avoid FastAPI treating static path names as workflow_id parameters.

@router.post("/workflows")
async def create_workflow(
    req: Dict[str, Any],
    manager: EngineManager = Depends(get_engine_manager),
):
    """Create and start a workflow from configuration."""
    if not manager.is_running():
        raise HTTPException(status_code=503, detail="Engine is not running")

    try:
        logger.debug(
            "create_workflow request received: files=%s mappings=%s",
            len(req.get("files", [])),
            len(req.get("mappings", [])),
        )

        # Parse workflow config from request
        config = WorkflowConfig.model_validate(req)

        logger.debug("workflow config validated: files=%s", len(config.files))

        # Generate workflow ID
        workflow_id = f"workflow-{int(time.time())}"

        # Submit workflow
        manager.workflow_manager.submit_workflow(workflow_id, config)

        return {"workflow_id": workflow_id, "status": "submitted"}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to create workflow")
        raise HTTPException(status_code=400, detail="Invalid workflow configuration")


# Dynamic workflow_id endpoints - must come AFTER static paths

@router.post("/workflows/{workflow_id}/start")
async def start_workflow(
    workflow_id: str,
    manager: EngineManager = Depends(get_engine_manager),
):
    """Start a workflow (alias for create - workflows auto-start on submit)."""
    status = manager.workflow_manager.get_status(workflow_id)
    if not status:
        raise HTTPException(status_code=404, detail=f"Workflow {workflow_id} not found")

    return {"workflow_id": workflow_id, "status": status["status"]}


@router.get("/workflows/{workflow_id}")
async def get_workflow_status(
    workflow_id: str,
    manager: EngineManager = Depends(get_engine_manager),
):
    """Get current workflow status."""
    status = manager.workflow_manager.get_status(workflow_id)
    if not status:
        raise HTTPException(status_code=404, detail=f"Workflow {workflow_id} not found")

    return status


@router.post("/workflows/{workflow_id}/stop")
async def stop_workflow(
    workflow_id: str,
    manager: EngineManager = Depends(get_engine_manager),
):
    """Stop a running workflow."""
    manager.workflow_manager.stop_workflow(workflow_id)
    return {"workflow_id": workflow_id, "status": "stopped"}






