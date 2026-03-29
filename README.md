# Mathcad Automator

Mathcad Automator runs Mathcad Prime calculations automatically — parameter studies, multi-file workflows, and batch exports, from a local web interface.

---

## Requirements

- **Operating System:** Windows 10 or Windows 11
- **Application:** PTC Mathcad Prime 5 or later installed
- **Python:** Version 3.11
- **Disk Space:** Approximately 2 GB for the application and output files

---

## Quick Start (Two Minutes)

1. **Double-click `demo.bat`** in the project root directory.
2. **Wait** for the server to start. The script creates a virtual environment, installs dependencies, and opens the app.
3. **Open your browser** to `http://localhost:8000`.

To stop the server, close the terminal window or press `Ctrl+C`.

---

## Batch Processing

Batch Processing runs a single Mathcad worksheet against many input combinations automatically. Use this for parameter studies, sensitivity analyses, and design-space exploration.

### Selecting a File

1. Navigate to the **Batch** tab in the web interface.
2. Click **Browse** and select a Mathcad Prime worksheet (.mcdx).
3. The system analyzes the file and displays detected input and output variables.

### Configuring Inputs

For each input variable, choose:
- **Range Mode:** Start value, end value, and step size — the system generates all values in that range.
- **Explicit Values Mode:** A comma-separated list of specific values — each value becomes one iteration.

### Combination vs. Permutation

- **Combination Mode** produces the Cartesian product of all input sets. With Input A having 3 values and Input B having 2 values, the batch runs 3 × 2 = 6 iterations covering all pairings.
- **Permutation Mode** steps all inputs simultaneously, index by index. With inputs `[1, 3, 5]` and `[10, 20]`, it runs two iterations: `(1, 10)` then `(3, 20)`.

### Output Options

Each batch run can produce:
- **Return Values** — Capture computed output variables into the results table.
- **Export PDF** — Save the worksheet as a PDF file for each iteration.
- **Export MCDX** — Save the calculated worksheet as an MCDX file for each iteration.

Output directory is set via the **Output Directory** dropdown:
- **Working Directory** — Run-specific folder under the project `runs/` directory.
- **Same as Source** — Same directory as the originating Mathcad file.
- **Custom Location** — An explicit path you specify.

### Starting a Batch Run

Click **Run Batch**. Progress updates row by row in the results table. Click **Stop Batch** to halt the run. In-progress iterations complete before the batch halts.

For the full Batch Processing guide, see [docs/batch-processing.md](docs/batch-processing.md).

---

## Workflow System

The Workflow System chains multiple Mathcad worksheets where outputs from one step feed directly into inputs of the next. You add steps in order, and each step uses the outputs from the previous steps.

### How It Works

1. Navigate to the **Workflow** tab in the web interface.
2. Click **Add Step** and select a Mathcad worksheet.
3. The system analyzes the file and lists detected input and output variables.
4. For each input that can use a prior step's output, an input mapping panel appears. Select the source step and output alias.
5. Units flow automatically from source to target. You can override with an explicit unit conversion if needed.

### Running a Workflow

Click **Run Workflow**. The system checks that steps are in a valid order, then runs each step in sequence. Progress updates step by step.

### Per-Step Export

Each step can independently export PDF and/or MCDX files. Enable exports in the step configuration panel.

For the full Workflow System guide, see [docs/workflow-system.md](docs/workflow-system.md).

---

## Setup (No Git)

If you do not have Git installed, you can download the project as a ZIP file:

1. Go to the project GitHub page and click the green **Code** button.
2. Select **Download ZIP**.
3. Extract the ZIP to a folder of your choice.
4. Double-click `demo.bat` in the extracted folder.
5. Open `http://localhost:8000` in your browser.

---

## Setup (With Git)

```cmd
# Clone the repository
git clone <repo-url>
cd Mathcad_exp

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Build the frontend (development/release engineering only)
cd frontend
npm install
npm run build
cd ..

# Start the server
python -m src.server.main
```

Open `http://localhost:8000` in your browser.

---

## Development Mode (Frontend with Hot Module Replacement)

```cmd
# Terminal 1 — start the backend
python scripts/dev_server.py

# Terminal 2 — start the frontend dev server (requires Node.js)
cd frontend
npm install
npm run dev
```

The frontend dev server runs on `http://localhost:5173` and proxies `/api` requests to `http://localhost:8000`. Changes to frontend files reload instantly.

**Note:** `npm run dev` reads directly from `frontend/src/` — it does not need `frontend/dist/`.

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| "Python not found" | Python is not in the system PATH | Install Python 3.11 and ensure "Add Python to PATH" is checked during installation. Restart the terminal and run `demo.bat` again. |
| `pip install` fails | Missing build tools, antivirus, or corrupted pip | Run `venv\Scripts\pip.exe install -r requirements.txt` manually to see the full error. Install missing build tools or temporarily disable antivirus. |
| Server does not start on port 8000 | Another process is using port 8000 | Open Command Prompt and run `netstat -ano \| findstr :8000` to find the PID. Then run `taskkill /PID <PID> /F` to stop it. |
| "Module not found" errors after updating code | Stale virtual environment | Delete the `venv\` folder and re-run `demo.bat`. It creates a fresh environment. |
| Mathcad connection error in the web interface | Mathcad Prime is not running or not installed | Launch Mathcad Prime manually first. Ensure it is licensed and activated. |
| Batch run produces no output files | Output directory is wrong or permissions issue | Check the output directory setting in the batch panel. Ensure the target directory exists and is writable. |
| PDF/MCDX export fails | File is open in Mathcad or another application | Close the file before running the batch or workflow. |
| "Cannot start because vcvarsall.bat not found" during pip install | Visual Studio Build Tools not installed | Install Visual Studio Build Tools for C++ (search "Visual Studio Build Tools download"). |
| Batch status shows "Retrying (Engine Restart)..." | Mathcad COM briefly disconnected | The system automatically restarts the engine and retries. Normal for long-running batches. |
| "No inputs detected" when loading a file | Worksheet has no externalized variables | Open the worksheet in Mathcad Prime and ensure inputs and outputs are properly defined. |
| Server returns 500 on batch start | Mathcad Prime not licensed or not activated | Open Mathcad Prime manually, verify it launches without dialogs, then retry. |
| `npm run dev` shows "Module not found" | Node modules not installed | Run `cd frontend && npm install` first. |
| Frontend shows "Loading..." forever | FastAPI server not started | Start the server with `python -m src.server.main` or `python scripts/dev_server.py`. |

---

## Documentation Map

- [Batch Processing Guide](docs/batch-processing.md) — Full batch processing reference
- [Workflow System Guide](docs/workflow-system.md) — Full workflow system reference
- [demo.bat Usage Guide](docs/demo.bat-guide.md) — Launcher walkthrough
- [Engineering Onboarding](docs/ONBOARDING.md) — Developer guide with architecture and setup
- [Architecture Reference](docs/developer/architecture.md) — How the backend is structured
