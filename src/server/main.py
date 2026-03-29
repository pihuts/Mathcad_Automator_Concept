import sys
import os
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from .dependencies import get_engine_manager
from .routes import get_all_routers


def get_app_data_dir() -> str:
    """
    Get the application data directory for user-specific data.
    Mirrors the function in main.py for backend access.
    """
    if getattr(sys, 'frozen', False):
        appdata = os.environ.get('LOCALAPPDATA')
        if not appdata:
            appdata = os.path.expanduser('~\\AppData\\Local')
        app_dir = os.path.join(appdata, 'MathcadAutomator')
    else:
        app_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'data')

    os.makedirs(app_dir, exist_ok=True)
    return app_dir


def get_frontend_path() -> Path:
    """
    Get path to frontend dist folder.
    Works for both development and PyInstaller bundle.
    """
    if getattr(sys, 'frozen', False):
        # Running in PyInstaller bundle
        base_path = Path(sys._MEIPASS)
    else:
        # Running in development - look for frontend/dist relative to project root
        base_path = Path(__file__).parent.parent.parent

    frontend_path = base_path / "frontend" / "dist"
    return frontend_path


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    manager = get_engine_manager()
    manager.start_engine()
    yield
    # Shutdown
    manager.stop_engine()


app = FastAPI(title="Mathcad Automator API", lifespan=lifespan)

# Include all modular route handlers
for router in get_all_routers():
    app.include_router(router, prefix="/api/v1")



@app.get("/health")
def health_check():
    """Health check endpoint for startup verification."""
    return {"status": "healthy"}


@app.get("/api/v1/app-info")
def get_app_info():
    """Return application information and paths."""
    return {
        "version": "1.0.0",
        "app_data_dir": get_app_data_dir(),
        "library_dir": os.path.join(get_app_data_dir(), 'libraries'),
    }


# Mount frontend static files (must be after API routes)
frontend_path = get_frontend_path()
if frontend_path.exists():
    app.mount("/", StaticFiles(directory=str(frontend_path), html=True), name="frontend")
else:
    print(f"Warning: Frontend not found at {frontend_path}. Run 'npm run build' in frontend/")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
