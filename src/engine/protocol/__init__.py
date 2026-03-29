"""Protocol package for engine communication types.

This module re-exports all protocol types for backward compatibility.
The underlying types are organized into:
- protocol.enums: All enum types
- protocol.models: All Pydantic model types
- protocol.dataclasses: All dataclass types
"""

# Enums
from .enums import (
    EngineStatus,
    FailureMode,
    PauseMode,
    StepStatus,
    WorkflowStatus,
)

# Pydantic Models
from .models import (
    InputConfig,
    FileMapping,
    WorkflowFile,
    ConditionalTermination,
    RetryConfig,
    AggregationMapping,
    WorkflowConfig,
    BatchConfig,
)

# Dataclasses
from .dataclasses import (
    JobRequest,
    JobResult,
    WorkflowState,
    StepResult,
    WorkflowCsvTable,
    WorkflowCreatedFile,
    WorkflowResultSummary,
    MappingSuggestion,
    CheckpointData,
)

__all__ = [
    # Enums
    "EngineStatus",
    "FailureMode",
    "PauseMode",
    "StepStatus",
    "WorkflowStatus",
    # Models
    "InputConfig",
    "FileMapping",
    "WorkflowFile",
    "ConditionalTermination",
    "RetryConfig",
    "AggregationMapping",
    "WorkflowConfig",
    "BatchConfig",
    # Dataclasses
    "JobRequest",
    "JobResult",
    "WorkflowState",
    "StepResult",
    "WorkflowCsvTable",
    "WorkflowCreatedFile",
    "WorkflowResultSummary",
    "MappingSuggestion",
    "CheckpointData",
]
