"""Engine control endpoints - start, stop, restart."""

from fastapi import APIRouter, Depends

from ..dependencies import get_engine_manager
from src.engine.manager import EngineManager
from ..schemas import ControlResponse

router = APIRouter()


@router.post("/control/stop", response_model=ControlResponse)
async def stop_engine(manager: EngineManager = Depends(get_engine_manager)):
    """Stop the engine."""
    manager.stop_engine()
    return ControlResponse(status="stopped", message="Engine stopped")


@router.post("/control/restart", response_model=ControlResponse)
async def restart_engine(manager: EngineManager = Depends(get_engine_manager)):
    """Restart the engine."""
    manager.restart_engine()
    return ControlResponse(status="restarted", message="Engine restarted")
