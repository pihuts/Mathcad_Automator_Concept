# Architecture Reference

This document provides an architectural overview of the Mathcad Automator backend for engineers who need to understand, modify, or extend the system.

---

## 1. System Overview

Mathcad Automator follows a four-layer architecture that separates HTTP handling, job orchestration, process isolation, and COM automation.

```
Layer 1: FastAPI Server (src/server/)
  └── HTTP endpoints, request validation, lifespan management

Layer 2: EngineManager (src/engine/manager.py)
  └── Job orchestration, process lifecycle, result collection via background thread

Layer 3: Harness Subprocess (src/engine/harness.py)
  └── Single-threaded job dispatcher running in a separate process
  └── Communicates with Layer 2 via multiprocessing.Queue

Layer 4: MathcadWorker (src/engine/worker.py)
  └── Direct COM automation calls to Mathcad Prime via MathcadPy
```

The layers communicate in a strict call/response pattern. The FastAPI server never accesses COM directly. All Mathcad operations flow through the harness subprocess, which runs on a single dedicated thread. This threading model is not a performance choice -- it is a hard requirement of the COM STA threading model.

---

## 2. Key Files and Their Roles

| File | Role |
|------|------|
| `src/server/main.py` | FastAPI app factory, lifespan (starts/stops engine), static file mounting for frontend |
| `src/server/routes/batch.py` | Batch run CRUD, start/stop/poll endpoints |
| `src/server/routes/workflow.py` | Workflow creation, run, and status endpoints |
| `src/server/routes/jobs.py` | Generic job submission and polling |
| `src/engine/manager.py` | EngineManager class: spawns harness process, owns input/output queues, runs collector thread |
| `src/engine/harness.py` | Harness entry point: `run_harness()` function, `COMMAND_HANDLERS` dispatch table, all command handlers |
| `src/engine/worker.py` | MathcadWorker class: all COM operations (connect, open, set inputs, get outputs, save) |
| `src/engine/batch/manager.py` | BatchManager: iteration loop, row dispatch, batch state persistence |
| `src/engine/workflow/manager.py` | WorkflowManager: DAG execution, checkpointing, conditional branching, multi-file chaining |
| `src/engine/protocol/dataclasses.py` | JobRequest, JobResult, WorkflowState, StepResult dataclasses |
| `src/engine/protocol/enums.py` | Command enum, StepStatus, WorkflowStatus, BranchAction, ConditionOperator enums |

### Protocol Classes

- **JobRequest**: Immutable dataclass sent from EngineManager to Harness via input_queue. Fields: `id` (UUID), `command` (string), `payload` (dict).
- **JobResult**: Immutable dataclass returned from Harness to EngineManager via output_queue. Fields: `job_id`, `status` ("success"|"error"), `data` (dict), `error_message` (optional).

---

## IMPORTANT: STA Threading Constraint

> **WARNING: This is the most critical constraint in the entire codebase.**

Mathcad Prime's COM interface uses **STA (Single-Threaded Apartment)** threading. COM objects are bound to the thread that created them. Calling any COM method from a different thread causes silent failures, hang, or `AttributeError` on all method calls.

**Rules:**

1. **Never use `func_timeout`** or any thread-based timeout with COM objects in `worker.py` or `harness.py`.
2. **Never use `asyncio`** for COM operations -- the harness runs in a plain `multiprocessing.Process`, not an async context.
3. **Never use `threading.Thread`** to run COM operations -- all COM calls must execute on the harness thread.
4. The harness is intentionally **single-threaded**. The `run_harness()` function runs a blocking loop that processes one job at a time.
5. If you need a timeout on a blocking COM call, use `EngineManager.wait_for_result()` -- this polls on the manager side without involving threads in the harness.

The `worker.py` file contains this warning in its module docstring and at every method that touches COM:

```python
# NOTE: Do NOT wrap in func_timeout - COM objects are STA (apartment-threaded)
# and cannot be accessed from a different thread
```

`manager.py`'s `wait_for_result()` method is the correct way to implement timeouts:

```python
def wait_for_result(self, job_id: str, timeout: float = 180.0) -> Optional[JobResult]:
    """Blocking wait for job result with timeout."""
    start = time.time()
    while time.time() - start < timeout:
        result = self.get_job(job_id)
        if result:
            return result
        time.sleep(0.1)
    return None
```

---

## 3. Command Dispatch Pattern

The harness uses a **dispatch table pattern** to route incoming commands to handler functions. This eliminates branching logic in the main loop and provides a single, obvious extension point for new operations.

### Adding a New Command

1. Define a handler function with signature: `def handle_xxx(worker: MathcadWorker, payload: Dict[str, Any]) -> Dict[str, Any]:`
2. Add it to the `COMMAND_HANDLERS` dictionary.

### Dispatch Table

```python
COMMAND_HANDLERS: Dict[str, Callable[[MathcadWorker, Dict[str, Any]], Dict[str, Any]]] = {
    "ping":                handle_ping,
    "connect":             handle_connect,
    "save_as":             handle_save_as,
    "load_file":           handle_load_file,
    "get_metadata":         handle_get_metadata,
    "calculate_job":       handle_calculate_job,
    "workflow_step":       handle_workflow_step,
    "workflow_clear":      handle_workflow_clear,
    "workflow_list":       handle_workflow_list,
    "workflow_save_as":    handle_workflow_save_as,
    "evaluate_row":        handle_evaluate_row,
    "process_batch_row":   handle_process_batch_row,
}
```

### Handler Function Pattern

Every handler follows the same pattern:

```python
def handle_xxx(worker: MathcadWorker, payload: Dict[str, Any]) -> Dict[str, Any]:
    # 1. Extract payload fields
    path = payload.get("path")

    # 2. Validate
    if not path:
        raise ValueError("Payload missing 'path'")

    # 3. Call worker methods
    print(f"[xxx] Starting operation...")
    worker.open_file(path)
    result_data = worker.get_outputs()

    # 4. Return dict (becomes JobResult.data)
    return {"outputs": result_data}
```

Errors are caught by the harness main loop and automatically wrapped into a `JobResult` with `status="error"` and the traceback as `error_message`.

---

## 4. Queue Communication

Jobs flow between layers exclusively through `multiprocessing.Queue` objects, never through direct function calls.

### Job Lifecycle

```
1. Server route handler
   └── engine_manager.submit_job(command, payload)
       └── Creates JobRequest(id=UUID, command=string, payload=dict)
       └── Puts JobRequest into input_queue
       └── Returns job_id to caller

2. Harness (subprocess, single-threaded loop)
   └── input_queue.get() blocks until a job is available
   └── Looks up handler in COMMAND_HANDLERS
   └── Calls handler(worker, payload) -- all COM happens here
   └── Creates JobResult(job_id, status, data)
   └── Puts JobResult into output_queue

3. EngineManager (collector thread)
   └── output_queue.get() with short timeout
   └── Stores result in self.results[job_id]
   └── Server polls via get_job(job_id)
```

### Key Files for Queue Logic

- `src/engine/manager.py`: `submit_job()`, `_collect_results()`, `get_job()`, `wait_for_result()`
- `src/engine/harness.py`: `run_harness()` -- the subprocess main loop
- `src/engine/protocol/dataclasses.py`: `JobRequest`, `JobResult`

The collector thread in `manager.py` runs continuously, draining `output_queue` as results arrive. It is a daemon thread that stops when `stop_collector` is set to `True` during `stop_engine()`.

---

## 5. Workflow State Machine

Workflows transition through a defined set of states managed by the `WorkflowStatus` enum in `src/engine/protocol/enums.py`.

### States

| State | Meaning |
|-------|---------|
| `PENDING` | Workflow created but not yet started |
| `RUNNING` | Actively executing steps |
| `COMPLETED` | All steps finished successfully |
| `FAILED` | A step errored and the workflow stopped |
| `STOPPED` | User manually stopped the workflow |
| `PAUSED` | Workflow paused between steps (e.g., for user review) |

### Transitions

```
PENDING -> RUNNING  (when first step begins)
RUNNING -> COMPLETED (all steps done, no errors)
RUNNING -> FAILED   (step raised an unhandled exception)
RUNNING -> STOPPED  (user requested stop)
RUNNING -> PAUSED   (pause mode = pause_each, user has not resumed)
PAUSED  -> RUNNING  (user resumed)
```

### Implementation

`WorkflowManager` in `src/engine/workflow/manager.py` owns state transitions. It validates the DAG structure using Kahn's algorithm before execution begins, ensuring no circular dependencies exist. Checkpointing occurs at the end of each step, storing `StepResult` objects and intermediate outputs to JSON. On restart, `CheckpointManager` reloads state and resumes from the last completed step.

Step-level status is tracked by `StepStatus` enum: `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`, `SKIPPED`, `BLOCKED`.

---

## 6. Related Documentation

- `docs/ONBOARDING.md` -- Comprehensive end-user onboarding with architecture diagrams, fragile area explanations, and development workflow guide.
- `src/engine/worker.py` -- Detailed comments on every COM operation.
- `src/engine/harness.py` -- Detailed comments on every command handler.
- `docs/ONBOARDING.md` -- Project onboarding and engineering memory, including the COM threading constraint.
