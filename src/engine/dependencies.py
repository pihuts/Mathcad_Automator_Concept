"""Dependency factory functions for the engine module.

These factory functions use @lru_cache to provide singleton instances,
replacing global module-level singletons with cached factory calls.

Usage:
    from engine.dependencies import get_engine_manager, get_batch_manager

    # Get singleton instance
    engine = get_engine_manager()

    # Reset all caches (useful for testing)
    reset_caches()
"""

from functools import lru_cache
from typing import Optional

# Type hints for circular import avoidance
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from engine.manager import EngineManager
    from engine.batch import BatchManager
    from engine.workflow import WorkflowManager, CheckpointManager
    from engine.mapping_suggester import MappingSuggester
    from engine.state_persistence.opened_files import OpenedFilesTracker


@lru_cache(maxsize=1)
def get_engine_manager() -> "EngineManager":
    """Get the singleton EngineManager instance.

    Creates the manager on first call, returns cached instance on
    subsequent calls. Use reset_caches() to create a fresh instance.

    Returns:
        EngineManager singleton instance
    """
    from engine.manager import EngineManager
    return EngineManager()


@lru_cache(maxsize=1)
def get_batch_manager() -> "BatchManager":
    """Get the singleton BatchManager instance.

    The BatchManager is created with the singleton EngineManager.

    Returns:
        BatchManager singleton instance
    """
    from engine.batch import BatchManager
    engine = get_engine_manager()
    return BatchManager(engine)


@lru_cache(maxsize=1)
def get_workflow_manager() -> "WorkflowManager":
    """Get the singleton WorkflowManager instance.

    The WorkflowManager is created with the singleton EngineManager.

    Returns:
        WorkflowManager singleton instance
    """
    from engine.workflow import WorkflowManager
    engine = get_engine_manager()
    return WorkflowManager(engine)


@lru_cache(maxsize=1)
def get_checkpoint_manager() -> "CheckpointManager":
    """Get the singleton CheckpointManager instance.

    Returns:
        CheckpointManager singleton instance
    """
    from engine.workflow.checkpoint import CheckpointManager
    return CheckpointManager()


@lru_cache(maxsize=1)
def get_mapping_suggester() -> "MappingSuggester":
    """Get the singleton MappingSuggester instance.

    Returns:
        MappingSuggester singleton instance
    """
    from engine.mapping_suggester import MappingSuggester
    return MappingSuggester()


@lru_cache(maxsize=1)
def get_opened_files_tracker() -> "OpenedFilesTracker":
    """Get the singleton OpenedFilesTracker instance.

    Returns:
        OpenedFilesTracker singleton instance
    """
    from engine.state_persistence.opened_files import OpenedFilesTracker
    return OpenedFilesTracker()


def reset_caches() -> None:
    """Reset all factory caches.

    Call this to create fresh singleton instances. Useful for testing
    where you need isolated state between tests.
    """
    get_engine_manager.cache_clear()
    get_batch_manager.cache_clear()
    get_workflow_manager.cache_clear()
    get_checkpoint_manager.cache_clear()
    get_mapping_suggester.cache_clear()
    get_opened_files_tracker.cache_clear()
