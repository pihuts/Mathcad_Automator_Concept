"""Protocol dataclasses for the engine module."""

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from .models import WorkflowConfig
    from .enums import StepStatus, WorkflowStatus


@dataclass
class JobRequest:
    """Job request for the harness process."""
    command: str
    payload: Dict[str, Any] = field(default_factory=dict)
    id: str = field(default_factory=lambda: str(uuid.uuid4()))


@dataclass
class JobResult:
    """Job result from the harness process."""
    job_id: str
    status: str  # "success" or "error"
    data: Dict[str, Any] = field(default_factory=dict)
    error_message: Optional[str] = None

    @property
    def is_success(self) -> bool:
        return self.status == "success"


@dataclass
class WorkflowState:
    """Workflow execution state."""
    workflow_id: str
    config: "WorkflowConfig"
    status: Optional["WorkflowStatus"] = None
    current_file_index: int = 0
    current_iteration: int = 0
    total_iterations: int = 0
    completed_iterations: int = 0
    completed_files: List[str] = field(default_factory=list)
    intermediate_results: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    intermediate_details: Dict[str, Dict[str, Dict[str, Dict[str, Any]]]] = field(default_factory=dict)
    error: Optional[str] = None
    final_results: Optional[Dict[str, Any]] = None
    # Phase 7 additions (backward compatible)
    step_results: List["StepResult"] = field(default_factory=list)
    paused_at_step: Optional[int] = None
    termination_message: Optional[str] = None
    checkpoint_path: Optional[str] = None


@dataclass
class WorkflowCsvTable:
    """Structured CSV table extracted from workflow artifacts."""
    path: str
    name: str
    headers: List[str]
    rows: List[List[Any]]


@dataclass
class StepResult:
    """Result of a single workflow step execution."""
    step_index: int
    file_path: str
    status: Optional["StepStatus"] = None
    outputs: Dict[str, Any] = field(default_factory=dict)
    inputs: Dict[str, Any] = field(default_factory=dict)  # Input values that were set on this step
    input_units: Dict[str, Optional[str]] = field(default_factory=dict)  # Input units that were set on this step
    error: Optional[str] = None
    error_detail: Optional[str] = None  # stack trace or detailed error
    retry_count: int = 0  # how many retries were attempted
    started_at: Optional[str] = None  # ISO timestamp
    completed_at: Optional[str] = None  # ISO timestamp
    iteration_id: Optional[str] = None  # Links to the iteration run directory
    iteration_index: Optional[int] = None  # The combo_idx (1-based iteration index)
    csv_tables: List[WorkflowCsvTable] = field(default_factory=list)
    csv_error: Optional[str] = None


@dataclass
class WorkflowCreatedFile:
    """Structured created-file metadata for workflow result surfaces."""
    path: str
    name: str
    format: str
    step_index: int
    step_name: str
    iteration_id: Optional[str] = None


@dataclass
class WorkflowResultSummary:
    """Run-level summary fields for workflow result surfaces."""
    completed_steps: int = 0
    total_steps: int = 0
    completed_iterations: int = 0
    total_iterations: int = 0
    created_file_count: int = 0
    pdf_count: int = 0
    mcdx_count: int = 0
    current_step_label: Optional[str] = None
    last_completed_step_label: Optional[str] = None


@dataclass
class MappingSuggestion:
    """Suggested mapping between source and target for smart mapping."""
    source_alias: str
    target_alias: str
    confidence: float  # 0-100 score
    reason: str  # e.g., "Name similarity: 85%"


@dataclass
class CheckpointData:
    """Checkpoint data for workflow pause/resume functionality."""
    workflow_id: str
    config: "WorkflowConfig"  # original config
    current_step_index: int
    step_results: List[StepResult] = field(default_factory=list)
    intermediate_results: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    intermediate_details: Dict[str, Dict[str, Dict[str, Dict[str, Any]]]] = field(default_factory=dict)
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
