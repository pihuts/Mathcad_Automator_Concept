"""Checkpoint management for workflow pause/resume functionality."""

import pickle
from pathlib import Path
from platformdirs import user_data_dir
from typing import List, Optional

from engine.protocol import CheckpointData, WorkflowState


class CheckpointManager:
    """Manages workflow checkpoint persistence for pause/resume functionality."""

    def __init__(self, app_name: str = "MathcadAutomator"):
        self.checkpoint_dir = Path(user_data_dir(app_name)) / "checkpoints"
        self.checkpoint_dir.mkdir(parents=True, exist_ok=True)

    def save_checkpoint(self, workflow_id: str, state: WorkflowState) -> str:
        """Save workflow state for resume.

        Args:
            workflow_id: Unique workflow identifier
            state: Current workflow state to save

        Returns:
            Path to the saved checkpoint file
        """
        checkpoint_path = self.checkpoint_dir / f"{workflow_id}.pkl"
        data = CheckpointData(
            workflow_id=state.workflow_id,
            config=state.config,
            current_step_index=state.current_file_index,
            step_results=state.step_results,
            intermediate_results=state.intermediate_results,
            intermediate_details=state.intermediate_details,
        )
        with open(checkpoint_path, 'wb') as f:
            pickle.dump(data, f)
        return str(checkpoint_path)

    def load_checkpoint(self, workflow_id: str) -> Optional[CheckpointData]:
        """Load checkpoint if exists.

        Args:
            workflow_id: Unique workflow identifier

        Returns:
            CheckpointData if checkpoint exists, None otherwise
        """
        checkpoint_path = self.checkpoint_dir / f"{workflow_id}.pkl"
        if not checkpoint_path.exists():
            return None
        with open(checkpoint_path, 'rb') as f:
            return pickle.load(f)

    def delete_checkpoint(self, workflow_id: str) -> None:
        """Clean up checkpoint after successful completion.

        Args:
            workflow_id: Unique workflow identifier
        """
        checkpoint_path = self.checkpoint_dir / f"{workflow_id}.pkl"
        if checkpoint_path.exists():
            checkpoint_path.unlink()

    def list_checkpoints(self) -> List[str]:
        """List available checkpoint workflow IDs.

        Returns:
            List of workflow IDs that have checkpoints
        """
        return [p.stem for p in self.checkpoint_dir.glob("*.pkl")]
