# Demo Explainer Outline: Workflow + Experimental Input + MathcadPy

## 1) Opening (30-45 seconds)
Use this short intro:

"Mathcad Automator helps us run multi-step Mathcad work without manual copy-paste between files. Today I will show three things: the workflow feature, the new `experimental_input`, and how we connect to Mathcad using MathcadPy behind the scenes."

## 2) What Problem We Solve
- Engineers often move values manually from one worksheet to another.
- That is slow and easy to get wrong.
- This app makes the process repeatable, traceable, and easier to run again.

## 3) Workflow Feature (Main Demo Flow)
### What to click
1. Open the **Workflow** tab.
2. Add 2-3 `.mcdx` files as steps.
3. Click analyze so each step shows detected inputs and outputs.
4. Map one output from an earlier step into an input of a later step.
5. Run the workflow.

### What to say while showing it
- "Each step can use outputs from earlier steps."
- "The app validates the step order before run."
- "Execution is step-by-step in sequence, so data flow is predictable."
- "We can pause/stop, and status is visible per step."

### What to show in results
- Step results and statuses.
- Created files (PDF/MCDX when enabled).
- Run summary / manifest for traceability.

## 4) New Experimental Input (`experimental_input`)
### What to show
- Open a step that has `experimental_input`.
- Show that it appears as **System Input** and is locked (not user editable).
- Show CSV result panel if CSV tables are produced.

### What to say
- "`experimental_input` is system-controlled, not a manual user field."
- "It is excluded from normal auto-mapping and normal parameter summaries."
- "At run time, the system injects a per-iteration location value for this input."
- "If the worksheet writes CSV outputs for that location, we collect and display them in workflow results."

## 5) How We Use Mathcad API (`MathcadPy`) in Simple Terms
Use this explanation:

"Our web app talks to a backend manager. That manager sends Mathcad jobs to a dedicated worker process. Inside that worker, MathcadPy does the real Mathcad operations: open worksheet, set inputs, run calculation, read outputs, and export files."

Key points to mention:
- We use `MathcadPy` as the Python bridge to Mathcad Prime COM.
- Workflow steps are executed through a single controlled lane for reliability.
- For each step we do: open -> set inputs -> calculate -> read outputs -> export (optional).

## 6) Reliability and Limits (Keep this brief)
- Steps run sequentially (not parallel).
- If a step fails, the workflow reports the failure clearly.
- `experimental_input` is intentionally locked to avoid accidental edits.
- The app supports checkpoint/recovery flows for resumable runs.

## 7) Q&A Backup Lines
- **Why sequential, not parallel?**
  "Mathcad COM is safest in a single controlled execution path."
- **What happens if a step fails?**
  "The step is marked failed, the error is captured, and the run can be retried/resumed depending on state."
- **How do we audit a run?**
  "Step results, exported artifacts, and run manifest give full traceability."
- **What is `experimental_input` for?**
  "A protected system channel for advanced data exchange, including CSV artifacts."

## 8) Suggested 7-Minute Demo Timing
1. Opening + problem: 1 minute
2. Workflow setup + run: 3 minutes
3. Experimental input focus: 1.5 minutes
4. MathcadPy architecture (simple): 1 minute
5. Q&A buffer: 0.5 minute
