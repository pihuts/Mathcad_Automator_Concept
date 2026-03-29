# Workflow System Guide

## Overview

The Workflow System chains multiple Mathcad Prime worksheets together so that outputs from one step become inputs to the next. This enables multi-step engineering calculations where the result of one analysis feeds directly into the next without manual data transfer.

Use the workflow system for:

- Sequential engineering analyses where each step builds on the previous
- Sensitivity studies that propagate through multiple calculation stages
- Automated design pipelines where File A → File B → File C represents a fixed calculation chain

---

## Core Concept: Steps in Order

Each workflow is a list of steps that run one after another. You define the steps in order, and each step can use the outputs from earlier steps as its inputs. The system checks that your steps are in a valid order before running.

---

## Adding a Step

1. Navigate to the **Workflow** tab in the web interface.
2. Click **Add Step**.
3. Select a Mathcad Prime worksheet (.mcdx) from the file browser.
4. The system analyzes the file and displays:
   - **Inputs:** Variables that can be set externally
   - **Outputs:** Variables that can be read after calculation

You can add as many steps as needed. Steps are numbered in the order added (Step 00, Step 01, etc.).

---

## Input Mapping Panel

When a step's inputs can be satisfied by outputs from a prior step, an input mapping panel appears next to the step.

For each mappable input, configure:

- **Source Step** — Which prior step provides the value. Select from the dropdown of earlier steps.
- **Source Output Alias** — The output variable name from that step.
- **Target Input Alias** — The input variable name in the current step that receives the value.

**Example:** Step 00 produces `stress`. Step 01 has an input `load_stress`. You map `stress` from Step 00 to `load_stress` in Step 01. When the workflow runs, the computed value of `stress` is automatically passed as `load_stress` to Step 01.

You can manually enter a fixed value instead of a source step reference for any input.

### Units Handling

Units flow automatically from source to target. If the upstream output carries a unit (e.g., `N/m^2`), the downstream input receives the same unit.

If you need to convert units explicitly, enter the target unit in the units override field for that mapping. The system passes the converted value to the downstream step.

---

## Running a Workflow

Click **Run Workflow**. The system checks that all steps are in a valid order (each step's inputs can be satisfied by earlier steps), then runs each step in sequence.

Steps run one after another. Each step:
1. Opens the Mathcad worksheet
2. Applies any input mappings from prior steps
3. Applies any manual input overrides
4. Triggers recalculation in Mathcad
5. Reads output values
6. Exports PDF/MCDX if per-step export is enabled
7. Writes step outputs to `outputs.json`
8. Advances to the next step

### Stopping a Workflow

Click **Stop Workflow** to halt execution. In-progress steps complete before the workflow stops.

---

## Per-Step Export

Each step can independently export PDF and/or MCDX files. In the step configuration panel:

- **Export PDF** — Saves the worksheet as a PDF after the step completes.
- **Export MCDX** — Saves the worksheet as an MCDX file after the step completes.

Files are named using the step index and original filename:

```
step_00_BeamAnalysis.pdf
step_01_StructuralDeflection.pdf
step_02_FinalReport.pdf
```

Per-step exports are useful when you want to capture intermediate results or generate a PDF trail of the entire workflow.

---

## Output Directory and Run Root

When a workflow runs, a **run root** directory is created. This is the top-level folder for all artifacts from this run. Use the **Output Directory** setting to choose where the run root is created:

- **Working Directory** — Run root is created as a timestamped folder under the project's `runs/` directory.
- **Same as Source** — Run root is created next to the first Mathcad file in the workflow.
- **Custom Location** — You specify an explicit base path.

---

## Artifact Organization

The run root directory is organized by step:

```
<run_root>/
  step_00_BeamAnalysis/
    outputs.json
    step_00_BeamAnalysis.pdf      (if PDF export enabled)
    step_00_BeamAnalysis.mcdx     (if MCDX export enabled)
  step_01_StructuralDeflection/
    outputs.json
    step_01_StructuralDeflection.pdf
    step_01_StructuralDeflection.mcdx
  step_02_FinalReport/
    outputs.json
    step_02_FinalReport.pdf
    step_02_FinalReport.mcdx
  run_manifest.json
```

Each step folder contains:

- `outputs.json` — A JSON file with all computed output values from that step, including any units metadata.
- Exported PDF and/or MCDX files if per-step export is enabled.

---

## Run Manifest

When a workflow completes (or stops), a `run_manifest.json` is written to the run root. This file provides a complete record of the run:

```json
{
  "workflow_name": "Beam to Deflection Pipeline",
  "run_timestamp": "2026-03-23T14-30-00",
  "status": "completed",
  "steps": [
    {
      "step_index": 0,
      "step_name": "BeamAnalysis",
      "status": "success",
      "duration_seconds": 12.3,
      "outputs": {
        "stress": { "value": 145.2, "units": "N/m^2" },
        "deflection": { "value": 0.0031, "units": "m" }
      }
    },
    {
      "step_index": 1,
      "step_name": "StructuralDeflection",
      "status": "success",
      "duration_seconds": 8.7,
      "outputs": {
        "max_deflection": { "value": 0.0041, "units": "m" }
      }
    }
  ],
  "artifacts": [
    "step_00_BeamAnalysis/outputs.json",
    "step_01_StructuralDeflection/outputs.json"
  ]
}
```

The manifest captures:
- Workflow name and run timestamp
- Per-step status, duration, and output values
- Paths to all artifact files

---

## Error Handling

If a step fails (Mathcad returns an error, the worksheet cannot be opened, or the COM connection is lost):

1. The step status is marked as `failed`.
2. The error message is recorded in the step's `outputs.json` and in the run manifest.
3. The workflow stops at that step.

To resume a failed workflow, correct the underlying issue (e.g., fix the Mathcad file, ensure Mathcad Prime is running) and restart the workflow.

---

## Limitations and Notes

- Workflow steps run sequentially, not in parallel. The harness is single-threaded because Mathcad COM requires STA threading.
- Input mappings are evaluated at step startup. The mapped values are locked in for that step's run.
- The workflow system does not support dynamic step creation at runtime. All steps must be defined before the run starts.
- If two steps have outputs with the same alias name, use the input mapping panel to disambiguate which source feeds which target.
