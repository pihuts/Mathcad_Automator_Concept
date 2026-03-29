# Batch Processing Guide

## Overview

Batch Processing lets you run a single Mathcad Prime worksheet across many input combinations automatically. Instead of manually changing inputs and recalculating, you define the inputs once and the system executes all iterations, captures results, and optionally exports PDF or MCDX files for each run.

Use batch processing for:

- Parameter studies (exploring how outputs change across input ranges)
- Sensitivity analyses (identifying which inputs have the largest effect on outputs)
- Design-space exploration (systematically sampling a design space)
- Regression testing (verifying that worksheet outputs remain consistent across updates)

---

## Step-by-Step Workflow

### 1. Browse and Select a File

Navigate to the **Batch** tab in the web interface. Click **Browse** and select a Mathcad Prime worksheet (.mcdx). The system connects to Mathcad Prime, opens the file, and analyzes it to detect input and output variables.

The analysis runs automatically. When complete, the interface displays:

- **Inputs:** Variables defined in the worksheet that can be set externally
- **Outputs:** Computed variables that can be read after calculation

If no inputs or outputs are detected, the file may not have defined any externalized variables. Check the worksheet in Mathcad Prime to ensure inputs and outputs are properly marked.

### 2. Configure Inputs

For each input variable, choose one of two configuration modes:

**Range Mode** -- Define a numeric range with start, end, and step values.

```
Example: start=1, end=5, step=2  ->  generates values [1, 3, 5]
```

Enter the start value, end value, and step size in the input configuration panel. The system generates all values from start to end at the given step interval.

**Explicit Values Mode** -- Provide a comma-separated list of specific values to test.

```
Example: 10, 25, 47, 100
```

Enter the comma-separated values in the input field. Each value becomes one iteration in the batch.

### 3. Select Output Options

Each batch run can produce:

- **Return Values** -- Read computed output variable values and display them in the results table.
- **Export PDF** -- Save the worksheet as a PDF file for each iteration.
- **Export MCDX** -- Save the worksheet as an MCDX file for each iteration.

Enable or disable each option using the checkboxes in the batch panel.

### 4. Choose Output Directory

Three modes are available from the **Output Directory** dropdown:

- **Working Directory** -- Files are saved in a run-specific folder created under the project directory. Folder names include a timestamp to prevent collisions.
- **Same as Source** -- Files are saved in the same directory as the original Mathcad worksheet.
- **Custom Location** -- You specify an explicit output path. The directory is created if it does not exist.

### 5. Set Combination or Permutation Mode

The **Mode** selector determines how multiple inputs are combined:

- **Combination Mode** -- Generates the Cartesian product of all input sets. If Input A has 3 values and Input B has 4 values, the batch produces 3 x 4 = 12 iterations. Use this for full factorial exploration.
- **Permutation Mode** -- Steps through all inputs in parallel. The system iterates through values index-by-index, advancing all inputs simultaneously. If inputs have different lengths, the run stops at the shortest list. Use this for synchronized sweep runs.

### 6. Start the Batch Run

Click **Run Batch** to begin. The system:

1. Generates the full list of input combinations based on the selected mode.
2. Opens the Mathcad worksheet for each iteration.
3. Sets the input values for that iteration.
4. Triggers recalculation in Mathcad.
5. Reads output values and optionally exports PDF/MCDX.
6. Updates the results table in real time.

You can monitor progress row by row. Each row shows the iteration index, status, input values, computed output values, and paths to any exported files.

To stop a running batch, click **Stop Batch**. In-progress iterations complete before the batch halts.

---

## Iteration Naming and File Organization

Each iteration produces a named output based on the input values used.

**Filename pattern:** `{base_name}_{input1-value}_{input2-value}_...{.pdf|.mcdx}`

```
Example: BeamAnalysis_L-10_W-5.pdf
```

If an input value contains characters that are invalid in filenames (`< > : " / \ | ? *`), they are replaced with underscores automatically.

Iterations are grouped inside the selected output directory:

```
<output_directory>/
  BeamAnalysis_L-1_W-5.pdf
  BeamAnalysis_L-1_W-10.pdf
  BeamAnalysis_L-3_W-5.pdf
  BeamAnalysis_L-3_W-10.pdf
  ...
```

If **Working Directory** mode is used, a timestamped run folder is created:

```
<project_dir>/
  runs/
    2026-03-23_14-30-00/
      BeamAnalysis_L-1_W-5.pdf
      BeamAnalysis_L-1_W-10.pdf
      ...
```

---

## Monitoring Progress

During a batch run, the results table updates in real time. Each row shows:

| Column | Description |
|--------|-------------|
| Row | Iteration index |
| Status | `running`, `success`, `failed`, or `stopped` |
| Stage | Current processing stage (`Processing...`, `Retrying...`, `Completed`, `Failed`) |
| Inputs | The input values used for this iteration |
| Outputs | The computed output values |
| PDF | Path to exported PDF (if enabled and saved) |
| MCDX | Path to exported MCDX (if enabled and saved) |

If a retry occurs (Mathcad COM briefly disconnects), the row status shows `Retrying (Engine Restart)...` and the system automatically restarts the engine before continuing.

---

## Results Table After Completion

When the batch completes, the full results table shows all iterations with their final status. You can:

- Review computed output values across all iterations.
- Click file paths to open exported PDFs or MCDX files.
- Copy results to the clipboard for import into Excel or another tool.
- Identify failed iterations (highlighted in red) and inspect error messages.

If any iterations failed, the batch status shows as **Completed with Errors**. All output files from successful iterations are preserved.

---

## Output Options Detail

### Return Values

When **Return Values** is enabled, the system reads every output variable defined in the worksheet after each iteration. Values are displayed in the results table. If an output cannot be read (e.g., the variable is not defined or returns an error), the cell shows `Error: <message>`.

### Export PDF

Saves the worksheet as a PDF file. Mathcad Prime's built-in PDF export is used. If a PDF already exists at the target path and **overwrite_existing** is disabled, the file is skipped. If overwrite is enabled (the default), existing files are replaced.

### Export MCDX

Saves the worksheet as an MCDX file (Mathcad Prime worksheet format). Use this to capture the state of the worksheet after input substitution and calculation. Like PDF export, MCDX export respects the overwrite_existing setting.

---

## Combination vs. Permutation -- Worked Example

Suppose you have two inputs:

- `Length`: values [1, 3, 5]
- `Width`: values [10, 20]

**Combination mode** produces all pairings:

| Iteration | Length | Width |
|----------|--------|-------|
| 1 | 1 | 10 |
| 2 | 1 | 20 |
| 3 | 3 | 10 |
| 4 | 3 | 20 |
| 5 | 5 | 10 |
| 6 | 5 | 20 |

**Permutation mode** steps in lockstep:

| Iteration | Length | Width |
|----------|--------|-------|
| 1 | 1 | 10 |
| 2 | 3 | 20 |

If input lists have different lengths in permutation mode, the run stops when the shorter list is exhausted.

---

## State Persistence

The batch manager saves checkpoint state every 5 iterations. If the server is restarted mid-batch, the batch state is preserved and can be resumed (if the API supports it). On clean completion, the checkpoint state file is deleted.

---

## Limitations and Notes

- Batch processing is sequential. Iterations do not run in parallel because Mathcad COM requires single-threaded access.
- If Mathcad Prime shows a dialog or prompt during an iteration, the batch hangs until the dialog is dismissed. Keep Mathcad Prime running without showing dialogs.
- Very long-running worksheets (minutes per iteration) may require increased timeout settings in the engine configuration.
- Output units are preserved as returned by Mathcad. If you need unit conversion, configure the output_units map in the batch settings.
