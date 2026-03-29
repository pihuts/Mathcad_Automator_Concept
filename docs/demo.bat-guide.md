# demo.bat Usage Guide

## What demo.bat Is

`demo.bat` is a one-click launcher that sets up the Mathcad Automator environment and starts the FastAPI server. It handles virtual environment creation, dependency installation, and server startup automatically -- you do not need to run any commands manually.

---

## Step-by-Step Walkthrough

When you double-click `demo.bat`, the script performs the following steps in order:

1. **Change to the script directory** -- The script changes to the directory where `demo.bat` is located (`%~dp0`). This ensures relative paths work regardless of where you launch it from.

2. **Check Python** -- Runs `python --version` to verify Python is installed. If Python is not found, the script exits with an error message: "Please install Python 3.11 first."

3. **Create virtual environment** -- If `venv\` does not exist, the script creates a new Python virtual environment by running `python -m venv venv`. This isolates the Mathcad Automator's dependencies from other Python projects on your system.

4. **Install dependencies** -- Runs `venv\Scripts\pip.exe install -r requirements.txt` to install all required Python packages (FastAPI, uvicorn, MathcadPy, etc.). This may take a few minutes on first run.

5. **Validate prebuilt frontend assets** -- Checks that `frontend\dist\index.html` exists. This release is intended to run without npm, so prebuilt frontend files are required.

6. **Start the FastAPI server** -- Runs `venv\Scripts\python.exe -m src.server.main` to launch the web server.

---

## Expected Output on Successful Startup

```
========================================
Mathcad Automator - Demo
========================================

Creating virtual environment...
Installing Python dependencies (this may take a few minutes)...
...
========================================
Starting Mathcad Automator...

URL: http://localhost:8000

Press Ctrl+C to stop the server
========================================
```

The server starts in the same terminal window. Keep this window open while using the application.

---

## URL to Open

- **Web Interface:** `http://localhost:8000`
- **API Documentation (Swagger UI):** `http://localhost:8000/docs`
- **Alternative API docs (ReDoc):** `http://localhost:8000/redoc`

---

## How to Stop the Server

Press `Ctrl+C` in the terminal window where `demo.bat` is running. The server shuts down cleanly.

Do not close the terminal window directly -- this can leave the server process running in the background. Always use `Ctrl+C` to stop gracefully.

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| "Python not found" | Python is not in the system PATH | Install Python 3.11 from python.org. During installation, enable "Add Python to PATH". Restart your computer after installation. |
| `pip install` fails with "vcvarsall.bat not found" | Visual Studio Build Tools not installed | Search "Visual Studio Build Tools for C++ download" and install them. Some Python packages require a C++ compiler. |
| `pip install` fails with access denied | Antivirus software blocking pip | Temporarily disable your antivirus during installation, or run Command Prompt as Administrator and re-run demo.bat. |
| Server starts but browser shows "This site cannot be reached" | Another process using port 8000 | Open Command Prompt and run `netstat -ano \| findstr :8000` to find the PID. Then `taskkill /PID <PID> /F` to stop the conflicting process. |
| "Module not found" errors after updating code | Stale virtual environment | Delete the `venv\` folder completely and re-run `demo.bat`. A fresh environment will be created with updated dependencies. |
| "Missing frontend\dist\index.html" | Prebuilt frontend assets were removed | Re-download the release package or restore the `frontend\dist\` folder. |
| `pip install` is very slow | Network connectivity to PyPI | Wait. On first run, pip downloads multiple packages. Subsequent runs use cached wheels and are much faster. |

---

## What to Expect in the Browser

After starting the server and opening `http://localhost:8000`, you see the Mathcad Automator web interface. The interface has two main tabs:

- **Batch** -- For running parameter studies with a single Mathcad file.
- **Workflow** -- For chaining multiple Mathcad files together.

Use the file browser to select Mathcad Prime worksheets. The system analyzes each file to detect inputs and outputs automatically.

---

## Re-running After Stopping

You can run `demo.bat` again after stopping it with `Ctrl+C`. Each run:

- Uses the existing `venv\` if it already exists (faster startup)
- Verifies `frontend\dist\index.html` exists
- Starts fresh each time -- there is no persistent server state across restarts

If you want a completely clean environment (new virtual environment, fresh dependencies), delete the `venv\` folder before running `demo.bat`.
