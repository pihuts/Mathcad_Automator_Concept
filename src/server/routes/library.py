"""Library endpoints for configuration persistence."""

import logging
from functools import lru_cache
from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Depends

from ..services.library_service import LibraryService

router = APIRouter()
logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_library_service() -> LibraryService:
    """Dependency injection for LibraryService."""
    return LibraryService()


# Batch Library Endpoints

@router.post("/library/save")
async def save_library_config(
    req: Dict[str, Any],
    service: LibraryService = Depends(get_library_service),
):
    """
    Save a batch configuration as a named library template.

    Configs are stored as JSON files in {mcdx_file_parent}/{mcdx_filename}_configs/
    """
    try:
        from src.engine.protocol import BatchConfig

        # Validate request using Pydantic
        config = BatchConfig(**req)

        # Save using library service
        config_path = service.save_config(
            config_type="batch",
            name=config.name,
            data=req,
            source_file=config.file_path,
        )

        return {
            "status": "success",
            "config_path": str(config_path),
            "config_name": config.name,
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        logger.exception("Failed to save batch library config")
        raise HTTPException(status_code=500, detail="Failed to save library config")


@router.get("/library/list")
async def list_library_configs(
    file_path: str,
    service: LibraryService = Depends(get_library_service),
):
    """
    List all saved library configurations for a given Mathcad file.

    Returns metadata (name, path, created_at) for each config.
    """
    try:
        configs = service.list_configs(
            config_type="batch",
            source_file=file_path,
        )
        return {"configs": configs}
    except FileNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        logger.exception("Failed to list batch library configs")
        raise HTTPException(status_code=500, detail="Failed to list library configs")


@router.post("/library/load")
async def load_library_config(
    req: Dict[str, Any],
    service: LibraryService = Depends(get_library_service),
):
    """
    Load a saved library configuration by file path.

    Returns BatchConfig with absolute paths resolved.
    """
    try:
        from src.engine.protocol import BatchConfig

        config_path = req.get("config_path")
        if not config_path:
            raise HTTPException(status_code=400, detail="Missing config_path")

        # Load using library service
        config_dict = service.load_config(
            config_type="batch",
            name="",  # Not needed when using config_path
            config_path=config_path,
        )

        # Validate with Pydantic
        config = BatchConfig.model_validate(config_dict)

        return config.model_dump(mode="json")
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception:
        logger.exception("Failed to load batch library config")
        raise HTTPException(status_code=500, detail="Failed to load library config")


# Workflow Library Endpoints

@router.post("/library/save/workflow")
async def save_workflow_config(
    req: Dict[str, Any],
    service: LibraryService = Depends(get_library_service),
):
    """
    Save a workflow configuration as a named library template.

    Workflows stored in workflow_library/ directory at project root.
    """
    try:
        from src.engine.protocol import WorkflowConfig

        # Validate request using Pydantic
        config = WorkflowConfig(**req)

        # Save using library service
        config_path = service.save_config(
            config_type="workflow",
            name=config.name,
            data=req,
        )

        return {
            "status": "success",
            "config_path": str(config_path),
            "config_name": config.name,
        }
    except Exception:
        logger.exception("Failed to save workflow library config")
        raise HTTPException(status_code=500, detail="Failed to save workflow config")


@router.get("/library/list/workflows")
async def list_workflow_configs(
    service: LibraryService = Depends(get_library_service),
):
    """
    List all saved workflow configurations.

    Returns metadata (name, path, created_at) for each config.
    """
    try:
        configs = service.list_configs(config_type="workflow")
        return {"configs": configs}
    except Exception:
        logger.exception("Failed to list workflow library configs")
        raise HTTPException(status_code=500, detail="Failed to list workflow configs")


@router.post("/library/load/workflow")
async def load_workflow_config(
    req: Dict[str, Any],
    service: LibraryService = Depends(get_library_service),
):
    """
    Load a saved workflow configuration by file path.

    Returns WorkflowConfig with absolute paths resolved.
    """
    try:
        from src.engine.protocol import WorkflowConfig

        config_path = req.get("config_path")
        if not config_path:
            raise HTTPException(status_code=400, detail="Missing config_path")

        # Load using library service
        config_dict = service.load_config(
            config_type="workflow",
            name="",  # Not needed when using config_path
            config_path=config_path,
        )

        # Validate with Pydantic
        config = WorkflowConfig.model_validate(config_dict)

        return config.model_dump(mode="json")
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception:
        logger.exception("Failed to load workflow library config")
        raise HTTPException(status_code=500, detail="Failed to load workflow config")
