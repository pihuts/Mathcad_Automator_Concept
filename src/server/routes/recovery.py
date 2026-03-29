"""Recovery endpoints for process state restoration."""

from fastapi import APIRouter, Depends

from ..dependencies import get_engine_manager
from src.engine.manager import EngineManager
from src.engine.state_persistence.batch_state import BatchStateManager

router = APIRouter()


@router.get("/recovery/state")
async def get_recovery_state(manager: EngineManager = Depends(get_engine_manager)):
    """Get state of all active processes for recovery UI.

    Returns consolidated state from:
    - Batch state files (if batches running)
    - Workflow checkpoints (if workflow running)
    - Opened files list

    Frontend can call this endpoint on startup to detect running processes
    and opened files after a disconnect.

    IMPORTANT: We cross-reference state files with in-memory state because
    state files can have stale "running" status if the backend was killed
    before it could update the status to "completed" or "stopped".
    """
    # Check batch states - MUST cross-reference with in-memory state
    # The batch_manager.batches dict only contains currently running batches.
    # State files can have stale "running" status if backend was killed.
    batch_mgr = BatchStateManager()
    batch_states = {}
    # Only include batches that are in the in-memory batches dict
    for batch_id, batch in manager.batch_manager.batches.items():
        if batch.get("status") == "running":
            state = batch_mgr.load_state(batch_id)
            if state:
                batch_states[batch_id] = state
            else:
                # Use in-memory state if no persisted state exists
                batch_states[batch_id] = batch

    # Check workflow checkpoints - only include if workflow is actually running
    all_checkpoints = manager.workflow_manager.checkpoint_mgr.list_checkpoints()
    workflow_checkpoints = []
    for checkpoint_id in all_checkpoints:
        # Check if this workflow is in the active workflows dict with running status
        workflow = manager.workflow_manager.workflows.get(checkpoint_id)
        if workflow and workflow.get("status") == "running":
            workflow_checkpoints.append(checkpoint_id)

    # Get opened files (for display purposes, not for has_active determination)
    opened_files = manager.get_opened_files() if hasattr(manager, "opened_files_tracker") else []

    # Determine if any active processes exist
    # NOTE: opened_files are NOT considered "active processes" - they're just
    # files that were open. Only running batches/workflows count.
    has_active = bool(
        batch_states or workflow_checkpoints
    )

    return {
        "has_active_processes": has_active,
        "batches": batch_states,
        "workflow_checkpoints": workflow_checkpoints,
        "opened_files": opened_files,
    }
