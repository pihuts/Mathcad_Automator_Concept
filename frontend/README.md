# Mathcad Automator Frontend

React 19 + TypeScript frontend for Mathcad Automator. The UI is served as pre-built static files by the FastAPI backend — no Node.js required at runtime for end users. Engineers with `npm run dev` access get hot module replacement during development.

## Project Overview

This is the web interface engineers use to:
- Run batch processing jobs against Mathcad Prime worksheets
- Build and execute multi-step workflow chains
- Monitor job progress and inspect results

The UI is built with:
- **React 19** with TypeScript
- **MUI (Material UI)** for component library
- **Vite** for development and production builds
- **Axios** for API communication

Brand guidelines (jade palette, typography, accessibility requirements) are documented in `docs/ONBOARDING.md` and `docs/developer/architecture.md`.

## Project Structure

```
frontend/src/
├── App.tsx                  # React root — tab-level view switching (Batch / Workflow)
├── main.tsx                 # React DOM entry point
├── services/
│   └── api.ts               # Axios API client — all backend calls centralized here
├── hooks/
│   ├── useBatch.ts          # Batch job state management
│   ├── useWorkflow.ts        # Workflow builder and execution state
│   ├── useLibrary.ts        # Workflow library management
│   └── useSettings.ts       # Application settings state
├── components/               # Reusable UI components
├── views/                   # View-level components
├── theme/
│   └── mui-theme.ts         # MUI theme configuration — jade palette, Linear+Notion aesthetic
├── types/                   # TypeScript type definitions
└── utils/                   # Utility functions (batch, CSV, workflow helpers)
```

**Key file responsibilities:**
- `App.tsx` — Routes between Batch, Workflow, Optimizer tabs based on URL hash
- `services/api.ts` — All HTTP calls to the FastAPI backend (`/api/v1/*`)
- `hooks/useBatch.ts` — Manages file loading, input configuration, batch execution state
- `hooks/useWorkflow.ts` — Manages step addition, input mapping, condition configuration, workflow execution

## Development Setup

### Prerequisites

- Node.js 18 or later
- The FastAPI backend running (see project root README for setup)

### One-Time Setup

```cmd
cd frontend
npm install
```

### Starting the Dev Server

```cmd
cd frontend
npm run dev
```

The Vite dev server runs on `http://localhost:5173` and proxies all `/api` requests to `http://localhost:8000` (the FastAPI backend). Changes to frontend source files reload instantly via HMR.

**Prerequisite:** The FastAPI backend must be running on port 8000 before starting the frontend dev server. Run in a separate terminal:

```cmd
# From project root
python scripts/dev_server.py
```

### Building for Production

```cmd
cd frontend
npm run build
```

Output is written to `frontend/dist/`, which is served as static files by the FastAPI backend.

## API Integration

The frontend communicates exclusively with the FastAPI backend via REST endpoints. All API calls are centralized in `src/services/api.ts`.

Key endpoints:
- `POST /api/v1/batch/start` — Start a batch run
- `GET /api/v1/batch/{batch_id}/status` — Poll batch status
- `POST /api/v1/workflow/start` — Start a workflow
- `GET /api/v1/jobs/{job_id}` — Poll job result
- `GET /health` — Server health check

## Testing

```cmd
# Run unit tests
npm run test

# Run type checking
npx tsc --noEmit

# Run linting
npm run lint
```

## Theme

The MUI theme is configured in `src/theme/mui-theme.ts`. It applies the project's jade-centered brand palette with teal support accents, following the project design guidance in `docs/ONBOARDING.md`.

Key theme tokens:
- Primary: Jade (#0D9488)
- Secondary: Teal (#14B8A6)
- Background: Light gray (#F8FAFC) in light mode
- Font: Outfit (UI text), JetBrains Mono (technical labels)

For accessibility requirements (WCAG 2.2 AA), see the design principles in `docs/ONBOARDING.md`.

## Adding a New API Endpoint

1. Add the route handler to the appropriate file in `src/server/routes/` (e.g., `batch.py` for batch endpoints).
2. Add the corresponding Pydantic schema to `src/server/schemas.py`.
3. Register the router in `src/server/routes/__init__.py`.
4. Add the API call to `src/services/api.ts`.
5. Create or update the relevant hook (`src/hooks/use*.ts`) to call the service.
6. Wire the hook into the appropriate view component.

The new endpoint is automatically mounted under `/api/v1`.
