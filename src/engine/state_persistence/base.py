"""
Base class for state persistence with file-based checkpointing.

Follows the CheckpointManager pattern from workflow_manager.py for
directory structure and file management.
"""

from abc import ABC, abstractmethod
from pathlib import Path
from platformdirs import user_data_dir
from typing import Any, Dict, List, Optional
from datetime import datetime


class StateManager(ABC):
    """
    Abstract base class for state persistence with periodic checkpointing.

    Provides common file-based state storage using the user data directory
    following the same pattern as CheckpointManager in workflow_manager.py.

    Subclasses implement specific state serialization for optimizer, batch,
    and other long-running processes.
    """

    def __init__(self, app_name: str = "MathcadAutomator"):
        """
        Initialize state manager with platform-specific user data directory.

        Args:
            app_name: Application name for directory resolution.
                      Defaults to "MathcadAutomator".
        """
        self.state_dir: Path = Path(user_data_dir(app_name)) / "state"
        self.state_dir.mkdir(parents=True, exist_ok=True)

    @abstractmethod
    def save_state(self, state_id: str, state: Dict[str, Any]) -> str:
        """
        Save state to file with atomic write pattern.

        Args:
            state_id: Unique identifier for this state (e.g., optimizer_id, batch_id)
            state: Dictionary containing state data to persist

        Returns:
            Path to the saved state file
        """
        pass

    @abstractmethod
    def load_state(self, state_id: str) -> Optional[Dict[str, Any]]:
        """
        Load state from file.

        Args:
            state_id: Unique identifier for the state to load

        Returns:
            Dictionary containing state data, or None if not found
        """
        pass

    @abstractmethod
    def delete_state(self, state_id: str) -> bool:
        """
        Delete state file after completion or cancellation.

        Args:
            state_id: Unique identifier for the state to delete

        Returns:
            True if file was deleted, False if it didn't exist
        """
        pass

    def list_states(self) -> List[str]:
        """
        List all available state IDs in the state directory.

        Returns:
            List of state identifiers (filenames without extension)
        """
        return [p.stem for p in self.state_dir.glob("*.json")]

    def _get_timestamp(self) -> str:
        """Get current timestamp in ISO format."""
        return datetime.now().isoformat()

    def _atomic_write(self, file_path: Path, content: str) -> None:
        """
        Write content to file using atomic write pattern.

        Writes to a temp file first, then replaces the target file.
        This prevents corruption if crash happens during write.

        Args:
            file_path: Target file path
            content: String content to write
        """
        temp_path = file_path.with_suffix(".tmp")
        temp_path.write_text(content, encoding="utf-8")
        temp_path.replace(file_path)
