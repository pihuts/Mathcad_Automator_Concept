"""
BatchStateManager for batch processing state checkpointing.

Persists batch progress, results, and generated files to disk
using atomic writes to prevent corruption on crash.
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from src.engine.state_persistence.base import StateManager


class BatchStateManager(StateManager):
    """
    State manager for batch processing checkpointing.

    Manages persistence of batch state including:
    - Batch progress (total, completed)
    - Row results (status, outputs, generated files)
    - Generated file paths
    - Error information

    Supports multiple concurrent batches with per-batch state files
    using the naming convention: batch_{batch_id}.json
    """

    FILE_PREFIX = "batch_"
    FILE_EXTENSION = ".json"

    def __init__(self, app_name: str = "MathcadAutomator"):
        """
        Initialize batch state manager.

        Args:
            app_name: Application name for directory resolution
        """
        super().__init__(app_name)

    def _get_state_file(self, batch_id: str) -> Path:
        """
        Get state file path for a batch.

        Args:
            batch_id: Unique batch identifier

        Returns:
            Path to the batch state file
        """
        return self.state_dir / f"{self.FILE_PREFIX}{batch_id}{self.FILE_EXTENSION}"

    def save_state(self, batch_id: str, state: Dict[str, Any]) -> str:
        """
        Save batch state to disk with atomic write.

        Args:
            batch_id: Unique identifier for this batch
            state: Batch state dict containing:
                - id: batch_id
                - total: total iterations
                - completed: completed iterations
                - results: List[dict] of row results
                - generated_files: List[str] of output file paths
                - status: "running" | "completed" | "stopped"
                - error: Optional[str]

        Returns:
            Path to the saved state file
        """
        # Ensure timestamp is included
        if "timestamp" not in state:
            state["timestamp"] = self._get_timestamp()

        state_file = self._get_state_file(batch_id)

        # Use atomic write pattern
        content = json.dumps(state, indent=2, default=str)
        self._atomic_write(state_file, content)

        return str(state_file)

    def load_state(self, batch_id: str) -> Optional[Dict[str, Any]]:
        """
        Load batch state from disk.

        Args:
            batch_id: Unique identifier for the batch to load

        Returns:
            Dictionary containing state data, or None if not found
        """
        state_file = self._get_state_file(batch_id)

        if not state_file.exists():
            return None

        try:
            content = state_file.read_text(encoding="utf-8")
            return json.loads(content)
        except (json.JSONDecodeError, IOError) as e:
            print(f"Warning: Failed to load batch state for {batch_id}: {e}")
            return None

    def delete_state(self, batch_id: str) -> bool:
        """
        Delete batch state file after completion or cancellation.

        Args:
            batch_id: Unique identifier for the batch to delete

        Returns:
            True if file was deleted, False if it didn't exist
        """
        state_file = self._get_state_file(batch_id)

        if state_file.exists():
            state_file.unlink()
            return True
        return False

    def load_all_states(self) -> Dict[str, Dict[str, Any]]:
        """
        Load all batch states from the state directory.

        Returns:
            Dictionary mapping batch_id to state dict
        """
        all_states = {}

        for state_file in self.state_dir.glob(f"{self.FILE_PREFIX}*{self.FILE_EXTENSION}"):
            # Extract batch_id from filename: batch_{batch_id}.json
            batch_id = state_file.stem[len(self.FILE_PREFIX):]

            try:
                content = state_file.read_text(encoding="utf-8")
                state = json.loads(content)
                all_states[batch_id] = state
            except (json.JSONDecodeError, IOError) as e:
                print(f"Warning: Failed to load batch state from {state_file}: {e}")
                continue

        return all_states

    def list_running_batches(self) -> List[str]:
        """
        List batch IDs of all currently running batches.

        Returns:
            List of batch IDs with status "running"
        """
        running = []
        all_states = self.load_all_states()

        for batch_id, state in all_states.items():
            if state.get("status") == "running":
                running.append(batch_id)

        return running

    def has_state(self, batch_id: str) -> bool:
        """
        Check if batch state exists.

        Args:
            batch_id: Unique batch identifier

        Returns:
            True if state file exists, False otherwise
        """
        return self._get_state_file(batch_id).exists()

    def get_state_timestamp(self, batch_id: str) -> Optional[str]:
        """
        Get timestamp of a batch state file.

        Args:
            batch_id: Unique batch identifier

        Returns:
            ISO timestamp string or None if no state exists
        """
        state = self.load_state(batch_id)
        if state:
            return state.get("timestamp")
        return None

    def cleanup_completed_batches(self) -> List[str]:
        """
        Remove state files for completed or stopped batches.

        Returns:
            List of batch IDs that were cleaned up
        """
        cleaned = []

        for batch_id, state in self.load_all_states().items():
            status = state.get("status")
            if status in ("completed", "stopped"):
                self.delete_state(batch_id)
                cleaned.append(batch_id)

        return cleaned
