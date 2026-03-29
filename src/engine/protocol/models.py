"""Protocol Pydantic models for the engine module."""

from datetime import datetime
from typing import Any, List, Optional, Literal, Dict

from pydantic import BaseModel, Field
from .enums import FailureMode, PauseMode


class InputConfig(BaseModel):
    """Configuration for a single input in a batch calculation."""
    alias: str
    value: Any
    units: Optional[str] = None  # Units specification (e.g., "in", "ft", "kip", or None for default)
    source: Optional[str] = None  # Added: file_path of source step if from mapping, None for direct


class FileMapping(BaseModel):
    """Maps an output from one file to an input in another."""
    source_file: str  # e.g., "file_a.mcdx"
    source_alias: str  # e.g., "Stress_Result"
    source_type: Literal["input", "output"] = "output"
    target_file: str  # e.g., "file_b.mcdx"
    target_alias: str  # e.g., "Input_Stress"
    units: Optional[str] = None  # Expected units for the target input (e.g., "in", "ft", "kip")


class WorkflowFile(BaseModel):
    """Single file in workflow chain."""
    file_path: str
    inputs: List[InputConfig]  # Reuse existing InputConfig
    position: int = Field(default=0, ge=0)  # 0, 1, 2 for linear chain A->B->C
    save_pdf: Optional[bool] = None
    save_mcdx: Optional[bool] = None
    mode: Literal["combination", "zip"] = "combination"
    output_units: Dict[str, str] = Field(default_factory=dict)  # NEW: {"alias": "unit"}


class ConditionalTermination(BaseModel):
    """Conditional termination criteria for workflow execution."""
    expression: str  # e.g., "(stress > 50000) AND (deflection < 2)"
    outcome: str = "failure"  # "success" or "failure"
    message: Optional[str] = None  # user-facing message when condition triggers
    after_step: int = -1  # evaluate after this step index (-1 = after every step)


class RetryConfig(BaseModel):
    """Retry configuration for failed workflow steps."""
    max_retries: int = 0  # 0 means no retry (fail fast)
    min_wait: int = 4  # minimum seconds between retries
    max_wait: int = 10  # maximum seconds between retries
    multiplier: int = 1  # exponential backoff multiplier


class AggregationMapping(BaseModel):
    """Aggregation mapping for combining multiple outputs into one input."""
    expression: str  # e.g., "max(stress_A, stress_B)"
    target_file: str  # target file path
    target_alias: str  # target input alias
    units: Optional[str] = None  # units for the aggregated value


class WorkflowConfig(BaseModel):
    """Complete workflow configuration."""
    name: str = Field(..., min_length=1, max_length=100)
    files: List[WorkflowFile]
    mappings: List[FileMapping]  # Links files together
    stop_on_error: bool = True  # Stop entire chain on failure
    export_pdf: bool = False
    export_mcdx: bool = False
    overwrite_existing: bool = True
    output_dir: Optional[str] = None
    output_dir_mode: Optional[Literal["source", "working", "custom"]] = Field(
        None,
        description="Controls where output files are saved. "
                    "'source' = same folder as source .mcdx file; "
                    "'working' = current working directory; "
                    "'custom' = path specified in output_dir. "
                    "When None, falls back to output_dir/timestamp/ (legacy behavior)."
    )
    iteration_mode: Literal["combination", "zip"] = "combination"
    # Phase 7 additions (backward compatible)
    failure_mode: FailureMode = FailureMode.STOP_ON_ERROR
    retry_config: Optional[RetryConfig] = None
    pause_mode: PauseMode = PauseMode.AUTO_RUN
    conditions: List[ConditionalTermination] = Field(default_factory=list)
    aggregation_mappings: List[AggregationMapping] = Field(default_factory=list)


class BatchConfig(BaseModel):
    """Complete batch configuration for library persistence."""
    name: str = Field(..., min_length=1, max_length=100)
    file_path: str  # Path to .mcdx file (will be stored as relative)
    inputs: List[InputConfig]  # Reuse existing InputConfig dataclass
    export_pdf: bool = False
    export_mcdx: bool = False
    overwrite_existing: bool = True
    output_dir: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    version: str = "1.0"

    # For relative path resolution
    base_path: Optional[str] = None  # Resolved at load time
    output_units: Dict[str, str] = Field(default_factory=dict)  # NEW
