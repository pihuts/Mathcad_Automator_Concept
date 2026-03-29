"""
State persistence module for Mathcad Automator.

Provides file-based checkpointing for batch processing state,
enabling recovery when the frontend disconnects.
"""

from src.engine.state_persistence.base import StateManager
from src.engine.state_persistence.batch_state import BatchStateManager

__all__ = [
    "StateManager",
    "BatchStateManager",
]
