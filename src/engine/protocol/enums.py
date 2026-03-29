"""Protocol enums for the engine module."""

from enum import Enum


class EngineStatus(str, Enum):
    IDLE = "IDLE"
    BUSY = "BUSY"
    ERROR = "ERROR"
    DEAD = "DEAD"


class FailureMode(str, Enum):
    """Failure handling modes for workflow execution."""
    STOP_ON_ERROR = "stop_on_error"  # fail fast, stop workflow
    RETRY = "retry"  # retry N times with backoff
    CONTINUE = "continue"  # skip failed step, continue to next


class PauseMode(str, Enum):
    """Pause modes for workflow execution."""
    AUTO_RUN = "auto_run"  # run all steps without pausing
    PAUSE_AFTER_EACH = "pause_each"  # pause after every step for user review


class StepStatus(str, Enum):
    """Status of a workflow step."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"  # step was skipped (continue mode)
    BLOCKED = "blocked"  # blocked by upstream failure


class WorkflowStatus(str, Enum):
    """Status of a workflow execution."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    STOPPED = "stopped"
    PAUSED = "paused"  # workflow paused between steps
