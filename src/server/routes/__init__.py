"""
Routes package for Mathcad Automator API.

This package contains modular route handlers organized by functionality:
- jobs: Job submission and result retrieval
- control: Engine control (start/stop/restart)
- batch: Batch processing operations
- workflow: Multi-step workflow execution
- files: File operations (browse/open)
- library: Configuration library management
- settings: Application settings
- recovery: Process recovery and status

Each module exports an APIRouter instance that can be mounted
in the main FastAPI application.
"""

from typing import List
from fastapi import APIRouter

# Import all route modules
from . import jobs
from . import control
from . import batch
from . import workflow
from . import files
from . import library
from . import settings
from . import recovery

__all__ = [
    "jobs",
    "control",
    "batch",
    "workflow",
    "files",
    "library",
    "settings",
    "recovery",
    "get_all_routers",
]


def get_all_routers() -> List[APIRouter]:
    """
    Return a list of all routers from this package.

    This is a convenience function for registering all routes
    in the main application.

    Returns:
        List of APIRouter instances from all route modules.
    """
    return [
        jobs.router,
        control.router,
        batch.router,
        workflow.router,
        files.router,
        library.router,
        settings.router,
        recovery.router,
    ]
