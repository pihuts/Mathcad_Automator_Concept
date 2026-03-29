"""Protocol interfaces for dependency injection.

These Protocol classes define the contracts for major engine components,
enabling dependency injection and easier testing with mocked implementations.
"""

from typing import Protocol, Dict, Any, Optional, List, runtime_checkable

from engine.protocol import (
    JobResult,
    JobRequest,
    WorkflowConfig,
    WorkflowState,
    CheckpointData,
    InputConfig,
)


@runtime_checkable
class EngineInterface(Protocol):
    """Protocol for the engine manager interface.

    Defines the contract for job submission and result retrieval.
    Used by BatchManager and WorkflowManager to communicate with the engine.
    """

    def submit_job(self, command: str, payload: Dict[str, Any]) -> str:
        """Submit a job to the engine.

        Args:
            command: Command name (e.g., 'calculate_job', 'workflow_step')
            payload: Command-specific payload

        Returns:
            Job ID for tracking
        """
        ...

    def get_job(self, job_id: str) -> Optional[JobResult]:
        """Get job result if available.

        Args:
            job_id: Job identifier

        Returns:
            JobResult if complete, None if still running
        """
        ...

    def start_engine(self) -> None:
        """Start the engine process."""
        ...

    def stop_engine(self) -> None:
        """Stop the engine process."""
        ...

    def restart_engine(self) -> None:
        """Restart the engine process."""
        ...

    def is_running(self) -> bool:
        """Check if engine is running."""
        ...


@runtime_checkable
class CheckpointInterface(Protocol):
    """Protocol for checkpoint management.

    Defines the contract for saving/loading workflow state checkpoints.
    Used by WorkflowManager for pause/resume functionality.
    """

    def save_checkpoint(self, workflow_id: str, state: WorkflowState) -> str:
        """Save workflow state for resume.

        Args:
            workflow_id: Unique workflow identifier
            state: Current workflow state

        Returns:
            Path to saved checkpoint
        """
        ...

    def load_checkpoint(self, workflow_id: str) -> Optional[CheckpointData]:
        """Load checkpoint if exists.

        Args:
            workflow_id: Unique workflow identifier

        Returns:
            CheckpointData if exists, None otherwise
        """
        ...

    def delete_checkpoint(self, workflow_id: str) -> None:
        """Clean up checkpoint after completion.

        Args:
            workflow_id: Unique workflow identifier
        """
        ...

    def list_checkpoints(self) -> List[str]:
        """List available checkpoint workflow IDs.

        Returns:
            List of workflow IDs with checkpoints
        """
        ...


@runtime_checkable
class StorageInterface(Protocol):
    """Protocol for configuration storage.

    Defines the contract for saving/loading configurations.
    Used by library services for batch/workflow config persistence.
    """

    def save_config(self, config_type: str, name: str, data: Dict[str, Any]) -> str:
        """Save configuration to storage.

        Args:
            config_type: 'batch' or 'workflow'
            name: Configuration name
            data: Configuration data

        Returns:
            Path to saved config
        """
        ...

    def load_config(self, config_type: str, name: str) -> Optional[Dict[str, Any]]:
        """Load configuration from storage.

        Args:
            config_type: 'batch' or 'workflow'
            name: Configuration name

        Returns:
            Configuration data if exists, None otherwise
        """
        ...

    def list_configs(self, config_type: str) -> List[str]:
        """List available configurations.

        Args:
            config_type: 'batch' or 'workflow'

        Returns:
            List of configuration names
        """
        ...

    def delete_config(self, config_type: str, name: str) -> bool:
        """Delete configuration from storage.

        Args:
            config_type: 'batch' or 'workflow'
            name: Configuration name

        Returns:
            True if deleted, False if not found
        """
        ...


@runtime_checkable
class MappingSuggesterInterface(Protocol):
    """Protocol for mapping suggestion services.

    Defines the contract for suggesting input/output mappings.
    Used by WorkflowManager for smart mapping features.
    """

    def suggest_mappings(
        self,
        source_outputs: List[Dict[str, Any]],
        target_inputs: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Suggest mappings between source outputs and target inputs.

        Args:
            source_outputs: List of source output metadata
            target_inputs: List of target input metadata

        Returns:
            List of suggested mappings with confidence scores
        """
        ...
