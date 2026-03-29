# Onboarding Guide

> **New to this codebase?** Start here. This is the single source of truth for understanding what Mathcad Automator does, how it is structured, and where to look when something breaks.

---

## 1. What This Project Does

Mathcad Automator is a Windows desktop application that automates Mathcad Prime calculations. Engineers use it to:

- **Batch mode** — Run a single worksheet against many input combinations at once. Each combination produces a PDF and a saved MCDX file.
- **Workflow mode** — Chain multiple worksheets together so that the outputs of one step feed into the inputs of the next. The workflow runs steps in order and stops if any step fails.

The app presents a native window with a React UI. A FastAPI backend handles job scheduling, and a dedicated sidecar process manages all communication with Mathcad Prime via its COM interface.

---

## 2. How It Works

The app runs as three processes on one machine:

```
Desktop Process
  └─ pywebview window (React UI)

Backend Process (FastAPI / uvicorn)
  └─ EngineManager
       ├─ BatchManager
       └─ WorkflowManager

Sidecar Process (single-threaded)
  ├─ Harness (COMMAND_HANDLERS loop)
  └─ MathcadWorker (Mathcad Prime COM)
```

**The key constraint**: Mathcad's COM interface uses STA (Single-Threaded Apartment) threading. All COM calls must stay on the sidecar's single thread. If COM calls are made from any other thread — including asyncio threads or `threading.Thread` pools — they silently fail or hang.

The FastAPI process and the sidecar communicate via `multiprocessing.Queue`. Jobs go in one queue; results come out the other. The EngineManager owns both queues and runs a collector thread that drains the output queue into a results dictionary.

---

## 3. Codebase Map

| Folder | What it contains |
|--------|-----------------|
| `src/` | All Python backend code |
| `src/server/` | FastAPI app, route handlers, dependency injection |
| `src/engine/` | EngineManager, harness, worker, batch, workflow, protocol types, DAG validator |
| `frontend/` | React 19 + TypeScript app (pre-built to `dist/`, served statically at runtime) |
| `tests/` | pytest test files (flat, not organized into `unit/`/`integration/` subdirectories) |
| `tests/engine/` | Engine-specific test files |
| `build/` | PyInstaller output (compiled `.exe`) |
| `docs/` | This document and other planning artifacts |

**Folders that do not exist**: `scripts/dev_server.py`, `setup_demo.bat`, `run_demo.bat`, `workflow_library/`, `tests/unit/`, `tests/integration/`, `tests/server/`, `main.py` in the root.

---

## 4. Key Files

### Backend entry point

- **`demo.bat`** — The quick-start script. Run this once to install dependencies and launch the app. It calls `venv\Scripts\python.exe -m src.server.main`.
- **`src/server/main.py`** — FastAPI app factory. Mounts all route routers, owns startup/shutdown lifecycle, serves the pre-built frontend as static files.
- **`src/server/dependencies.py`** — Holds the singleton `EngineManager` instance (accessed via `get_engine_manager()`).

### Engine

- **`src/engine/manager.py`** — `EngineManager`. Spawns the harness subprocess, owns the input/output queues, runs the collector thread, delegates to `BatchManager` and `WorkflowManager`.
- **`src/engine/harness.py`** — Sidecar process. Runs a single-threaded `COMMAND_HANDLERS` loop that routes every Mathcad operation. This is the only extension point inside the sidecar.
- **`src/engine/worker.py`** — `MathcadWorker`. Thin wrapper around MathcadPy's COM interface. All COM interaction lives here.

### Batch and workflow

- **`src/engine/batch/manager.py`** — Batch execution loop. Polls for ready rows, submits jobs, checkpoints state every 5 rows.
- **`src/engine/workflow/manager.py`** — Workflow execution engine. Runs steps in order, handles per-step failure, checkpoints DAG state.

### Protocol and state

- **`src/engine/protocol/`** — Shared types: `JobRequest`, `JobResult`, and related dataclasses.
- **`src/engine/state_persistence/`** — JSON checkpoint files for batch and workflow recovery.
- **`src/engine/dag_validator.py`** — Validates workflow step ordering before execution.

### Routes

- **`src/server/routes/__init__.py`** — Exports all routers via `get_all_routers()`. Registers: `jobs`, `control`, `batch`, `workflow`, `files`, `library`, `settings`, `recovery`.

### Frontend

- **`frontend/src/App.tsx`** — React root. Switches between Batch and Workflow views.
- **`frontend/src/services/api.ts`** — Axios API client. All backend calls are centralized here.
- **`frontend/src/hooks/useBatch.ts`** — Batch state management.
- **`frontend/src/hooks/useWorkflow.ts`** — Workflow state management.

---

## 5. COM Threading Rule

> **WARNING: Never use `func_timeout`, `threading.Thread`, or `asyncio` in the harness or worker.**
>
> Mathcad's COM interface uses STA (Single-Threaded Apartment) threading. Objects are bound to the thread that created them. `func_timeout` runs your code in a new thread — every COM method call from that thread will raise `AttributeError`. The same applies to `threading.Thread` and any asyncio code that leaves the harness thread.
>
> If you need a timeout, use `EngineManager.wait_for_result()` which polls from the manager side without involving threads in the harness.

The comment is written directly in `src/engine/worker.py` at the top of the file. Read it before making any changes to the harness or worker.

---

## 6. Quick Start

### First time

```cmd
demo.bat
```

This installs Python dependencies into a local `venv/`, validates that prebuilt frontend assets exist in `frontend/dist/`, and starts the app at `http://localhost:8000`.

### Development (frontend with hot module replacement)

```cmd
cd frontend
npm run dev
```

This starts the frontend dev server at `http://localhost:5173` with HMR. It proxies `/api` requests to the backend at `http://localhost:8000`.

To also run the backend in dev mode with auto-reload:

```cmd
venv\Scripts\python.exe -m src.server.main
```

---

## 7. Running Tests

**Backend tests** (pytest):

```cmd
pytest tests/ -v
```

**Frontend tests** (vitest):

```cmd
cd frontend
npm run test
```

**Linting** (frontend):

```cmd
cd frontend
npm run lint
```

---

## 8. Key Design Decisions

### Singleton EngineManager

`EngineManager` is created once via `get_engine_manager()` in `src/server/dependencies.py` and shared across all API requests. It owns the harness subprocess and all queue communication. There is no eviction — `EngineManager.results` accumulates `JobResult` objects for the lifetime of the process. Long-running batches accumulate results in memory.

### Pre-built frontend

`frontend/dist/` is committed to the repository and served as static files by `src/server/main.py`. The frontend only needs Node.js during development. Production runs without Node.js.

### Dev vs frozen paths

- **Development**: App data is written to `./data/` (project-relative).
- **Frozen (.exe built with PyInstaller)**: App data goes to `%LOCALAPPDATA%\MathcadAutomator\`.

Both paths are computed independently in `src/server/main.py` and `demo.bat`.

### Dispatch table pattern in harness

New Mathcad commands are added by registering a function in the `COMMAND_HANDLERS` dict in `src/engine/harness.py`. The main loop does not need to change.

### Two separate checkpoint systems

`BatchStateManager` and `CheckpointManager` are intentionally separate. Batch checkpoints are simple. Workflow checkpoints include full DAG state, step results, and file mappings. They share no base class.

---

## 9. Fragile Areas

### COM STA threading (critical)

The entire sidecar process is single-threaded by design. Any `asyncio`, `threading`, or `func_timeout` introduced into the harness path will silently break COM calls. There is no runtime guard — if you break this, Mathcad calls will fail with no helpful error message until you read the worker.py header comment.

### Engine restart on batch failure

`batch/manager.py` calls `restart_engine()` when a row fails. This destroys and recreates the entire sidecar process. It masks root causes rather than fixing them. A more targeted COM session reset would be safer.

### No result eviction

`EngineManager.results` has no size cap, no TTL, and no read-and-delete. A 1000-iteration batch leaves all results in memory until the FastAPI process exits.

### Missing dist silent failure

If `frontend/dist/` is missing when the backend starts, `src/server/main.py` serves a 404 with only a `print()` to stdout — no crash, no user-visible error in the app.

### WorkflowState schema stability

`CheckpointManager` serializes `WorkflowState` to JSON. Adding a field to the dataclass breaks resume-from-checkpoint for any workflow started before the change. There is no schema migration path.

### App.tsx is large

`frontend/src/App.tsx` is over 1200 lines. It serves as both route-level router and layout shell. No structural pattern (context providers, composition, or module sections) makes navigation within the file easier.

---

*Maintain this file when architectural decisions change. It is the first document a new engineer will read.*
