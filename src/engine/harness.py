"""Harness process for handling Mathcad jobs in a separate process.

IMPORTANT: This module runs in a subprocess and handles COM operations.
All COM operations MUST stay on this single thread - never use async or
threading for COM operations.

The harness uses a dispatch table pattern to route commands to handlers,
making it easy to add new commands without modifying the main loop.
"""

import time
import multiprocessing
import traceback
import sys
import os
from pathlib import Path
from queue import Empty
from typing import Callable, Dict, Any

try:
    from engine.protocol import JobRequest, JobResult
    from engine.worker import MathcadWorker
    from engine.utils import extract_input_config
except ModuleNotFoundError:
    current_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(current_dir)
    if parent_dir not in sys.path:
        sys.path.insert(0, parent_dir)
    from engine.protocol import JobRequest, JobResult
    from engine.worker import MathcadWorker
    from engine.utils import extract_input_config


def handle_ping(worker: MathcadWorker, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Handle ping command - returns pong."""
    print("[ping] Responding with pong")
    return {"response": "pong"}


def handle_connect(worker: MathcadWorker, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Handle connect command - connects to Mathcad application."""
    print("[connect] Connecting to Mathcad...")
    worker.connect()
    print("[connect] Connected successfully")
    return {"message": "Connected to Mathcad"}


def handle_save_as(worker: MathcadWorker, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Handle save_as command - opens source file, sets inputs, saves to target."""
    path = payload.get("path")
    source_path = payload.get("source_path")
    inputs_config = payload.get("inputs", [])
    if not path:
        raise ValueError("Payload missing 'path'")

    print(f"[save_as] Target: {path} | source: {source_path} | inputs: {len(inputs_config)}")

    if source_path:
        print(f"[save_as] Opening source file: {source_path}")
        worker.open_file(source_path)
        print(f"[save_as] Source file opened")

    if inputs_config:
        for input_config in inputs_config:
            alias, value, units = extract_input_config(input_config)
            print(f"[save_as] Setting input '{alias}' = {value} (units: '{units}')")
            if alias and value is not None:
                worker.set_input(alias, value, units)

    print(f"[save_as] Saving to: {path}")
    worker.save_as(path)
    print(f"[save_as] Save complete")
    return {"message": f"Saved to {path}"}


def handle_load_file(worker: MathcadWorker, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Handle load_file command - opens a Mathcad file."""
    path = payload.get("path")
    if not path:
        raise ValueError("Payload missing 'path'")
    print(f"[load_file] Opening: {path}")
    worker.open_file(path)
    print(f"[load_file] File opened successfully")
    return {"message": f"Opened {path}"}


def handle_get_metadata(worker: MathcadWorker, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Handle get_metadata command - gets inputs and outputs from a file."""
    connected = worker.is_connected()
    print(f"[get_metadata] Starting. is_connected={connected}, current_file={worker.current_file_path}")
    if not connected:
        print("[get_metadata] Reconnecting to Mathcad...")
        worker.connect()
        print(f"[get_metadata] Reconnected. is_connected={worker.is_connected()}")

    path = payload.get("path")
    print(f"[get_metadata] Requested path: {path}")
    if path:
        print(f"[get_metadata] Opening file...")
        worker.open_file(path)
        print(f"[get_metadata] File opened successfully. worksheet={worker.worksheet}")

    print(f"[get_metadata] Getting inputs...")
    inputs = worker.get_inputs()
    print(f"[get_metadata] Got {len(inputs)} inputs: {[i['alias'] for i in inputs]}")
    print(f"[get_metadata] Getting outputs...")
    outputs = worker.get_outputs()
    print(f"[get_metadata] Got {len(outputs)} outputs: {[o['alias'] for o in outputs]}")
    return {"inputs": inputs, "outputs": outputs}


def handle_calculate_job(worker: MathcadWorker, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Handle calculate_job command - sets inputs and retrieves outputs."""
    path = payload.get("path")
    inputs_config = payload.get("inputs", [])
    print(f"[calculate_job] Path: {path} | inputs: {len(inputs_config)}")

    if path:
        print(f"[calculate_job] Opening file...")
        worker.open_file(path)
        print(f"[calculate_job] File opened")

    for input_config in inputs_config:
        alias, value, units = extract_input_config(input_config)
        print(f"[calculate_job] Setting input '{alias}' = {value} (units: '{units}')")
        if alias and value is not None:
            worker.set_input(alias, value, units)

    print(f"[calculate_job] Fetching outputs...")
    output_names = worker.worksheet.outputs()
    output_data = {}

    for alias in output_names:
        try:
            val, units, error_code = worker.worksheet.get_real_output(alias)
            if error_code != 0:
                output_data[alias] = f"Error: ErrorCode {error_code}"
            else:
                output_data[alias] = val
            print(f"[calculate_job] Output '{alias}' = {val}")
        except Exception as e:
            output_data[alias] = f"Error: {str(e)}"
            print(f"[calculate_job] Output '{alias}' ERROR: {e}")

    print(f"[calculate_job] Complete. {len(output_data)} outputs collected")
    return {"outputs": output_data}


def handle_workflow_step(worker: MathcadWorker, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Handle workflow_step command - executes a workflow step with inputs."""
    path = payload.get("path")
    inputs_config = payload.get("inputs", [])
    units_map = payload.get("units_map", {})
    print(f"[workflow_step] Path: {path} | inputs: {len(inputs_config)} | units_map keys: {list(units_map.keys())}")

    if not path:
        raise ValueError("Payload missing 'path'")

    print(f"[workflow_step] Ensuring worksheet is available in workflow context...")
    worker.workflow_open_file(path)
    print(f"[workflow_step] Setting inputs...")
    worker.workflow_set_inputs(path, inputs_config)
    print(f"[workflow_step] Activating worksheet...")
    worker.workflow_activate(path)
    print(f"[workflow_step] Getting outputs...")
    output_data = worker.workflow_get_outputs(path, units_map)
    print(f"[workflow_step] Complete. Outputs: {list(output_data.keys())}")

    return {"outputs": output_data}


def handle_workflow_clear(worker: MathcadWorker, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Handle workflow_clear command - clears workflow worksheets."""
    print(f"[workflow_clear] Clearing workflow worksheets...")
    worker.workflow_clear()
    print(f"[workflow_clear] Cleared")
    return {"message": "Workflow worksheets cleared"}


def handle_workflow_list(worker: MathcadWorker, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Handle workflow_list command - lists open worksheets."""
    print(f"[workflow_list] Getting open worksheets...")
    open_worksheets = worker.workflow_get_open_worksheets()
    print(f"[workflow_list] Found {len(open_worksheets)} open worksheets")
    return {"open_worksheets": open_worksheets, "count": len(open_worksheets)}


def handle_workflow_save_as(worker: MathcadWorker, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Handle workflow_save_as command - saves a workflow worksheet."""
    worksheet_path = payload.get("worksheet_path")
    save_path = payload.get("path")
    if not worksheet_path or not save_path:
        raise ValueError("Payload missing 'worksheet_path' or 'path'")

    print(f"[workflow_save_as] Activating worksheet: {worksheet_path}")
    worker.workflow_activate(worksheet_path, activate=True)
    print(f"[workflow_save_as] Saving to: {save_path}")
    worker.save_as(save_path)
    if Path(save_path).suffix.lower() == ".mcdx":
        worker.workflow_register_alias(worksheet_path, save_path)
    print(f"[workflow_save_as] Save complete")
    return {"message": f"Saved to {save_path}"}


def handle_workflow_validate(worker: MathcadWorker, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Handle workflow_validate command - validates a worksheet and returns its designated inputs.

    This is used for pre-execution validation to check if a worksheet is still accessible
    and has the expected inputs before attempting to run a workflow step.

    If the worksheet is not yet in the workflow context (opened via workflow_open_file),
    this handler will auto-open it first.
    """
    path = payload.get("path")
    expected_inputs = payload.get("expected_inputs", [])  # List of alias strings to check
    warn_on_extra_inputs = bool(payload.get("warn_on_extra_inputs", False))
    print(
        f"[workflow_validate] Path: {path} | expected_inputs: {expected_inputs} | "
        f"warn_on_extra_inputs={warn_on_extra_inputs}"
    )

    if not path:
        raise ValueError("Payload missing 'path'")

    # Auto-open worksheet in workflow context if not already open
    # This handles the case where files were opened via open_file() during analyze phase
    # but not via workflow_open_file() in the workflow context
    abs_path = str(Path(path).resolve())
    if abs_path not in worker.workflow_worksheets:
        print(f"[workflow_validate] Worksheet not in workflow context, opening now...")
        try:
            worker.workflow_open_file(path)
            print(f"[workflow_validate] Opened worksheet in workflow context")
        except Exception as e:
            return {
                "is_valid": False,
                "inputs": [],
                "error": f"Failed to open worksheet: {e}",
                "needs_reconnect": False,
                "reconnect_failed": False,
                "input_discrepancies": []
            }

    # Validate worksheet
    validation = worker.workflow_validate_worksheet(path)

    if not validation["is_valid"]:
        if validation["needs_reconnect"]:
            print(f"[workflow_validate] Worksheet stale, attempting reconnect...")
            reconnect_ok = worker.workflow_reconnect_worksheet(path)
            if reconnect_ok:
                # Re-validate after reconnect
                validation = worker.workflow_validate_worksheet(path)
            else:
                validation = {**validation, "reconnect_failed": True}
        else:
            validation = {**validation, "reconnect_failed": False}

    # Check for input discrepancies if expected_inputs provided.
    # By default, expected_inputs is treated as the set of aliases the workflow
    # intends to set for this step (not the worksheet's full schema). In that
    # mode we only flag missing expected aliases.
    input_discrepancies = []
    if expected_inputs and validation["is_valid"]:
        actual_inputs = set(validation["inputs"])
        expected_set = set(expected_inputs)
        missing = expected_set - actual_inputs
        if missing:
            input_discrepancies.append(f"Expected inputs not found in worksheet: {sorted(missing)}")
        if warn_on_extra_inputs:
            extra = actual_inputs - expected_set
            if extra:
                input_discrepancies.append(f"Worksheet has extra inputs not in workflow config: {sorted(extra)}")

    print(f"[workflow_validate] Result: is_valid={validation['is_valid']}, "
          f"inputs_count={len(validation.get('inputs', []))}, "
          f"discrepancies={len(input_discrepancies)}")

    return {
        "is_valid": validation["is_valid"],
        "inputs": validation.get("inputs", []),
        "error": validation.get("error"),
        "needs_reconnect": validation.get("needs_reconnect", False),
        "reconnect_failed": validation.get("reconnect_failed", False),
        "input_discrepancies": input_discrepancies
    }


def handle_workflow_get_inputs(worker: MathcadWorker, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Handle workflow_get_inputs command - gets designated inputs from a workflow worksheet.

    Used for pre-execution validation to retrieve the current list of designated inputs.
    """
    path = payload.get("path")
    print(f"[workflow_get_inputs] Path: {path}")

    if not path:
        raise ValueError("Payload missing 'path'")

    try:
        inputs = worker.workflow_get_inputs(path)
        print(f"[workflow_get_inputs] Got {len(inputs)} inputs: {[i['alias'] for i in inputs]}")
        return {"inputs": inputs}
    except Exception as e:
        print(f"[workflow_get_inputs] ERROR: {e}")
        return {"inputs": [], "error": str(e)}


def handle_evaluate_row(worker: MathcadWorker, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Handle evaluate_row command - evaluates a row with inputs."""
    path = payload.get("path")
    inputs_config = payload.get("inputs", [])
    units_map = payload.get("units_map", {})  # NEW
    print(f"[evaluate_row] Path: {path} | inputs: {len(inputs_config)} | units_map keys: {list(units_map.keys())}")

    if path:
        print(f"[evaluate_row] Opening file...")
        worker.open_file(path)
        print(f"[evaluate_row] File opened")

    print(f"[evaluate_row] Evaluating row...")
    output_data = worker.evaluate_row(inputs_config, units_map=units_map)
    print(f"[evaluate_row] Complete. Outputs: {list(output_data.keys())}")

    return {"outputs": output_data}


def handle_process_batch_row(worker: MathcadWorker, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Handle process_batch_row command - processes a batch row with optional PDF/MCDX export."""
    path = payload.get("path")
    inputs_config = payload.get("inputs", [])
    export_pdf = payload.get("export_pdf", False)
    pdf_path = payload.get("pdf_path")
    export_mcdx = payload.get("export_mcdx", False)
    mcdx_path = payload.get("mcdx_path")
    overwrite_existing = payload.get("overwrite_existing", True)
    print(f"[process_batch_row] Path: {path} | inputs: {len(inputs_config)} | pdf: {export_pdf} | mcdx: {export_mcdx}")

    if path:
        print(f"[process_batch_row] Opening file...")
        worker.open_file(path)
        print(f"[process_batch_row] File opened")

    # Set Inputs
    for input_config in inputs_config:
        alias, value, units = extract_input_config(input_config)
        print(f"[process_batch_row] Setting input '{alias}' = {value} (units: '{units}')")
        if alias and value is not None:
            worker.set_input(alias, value, units)

    # Export PDF
    pdf_saved = False
    if export_pdf and pdf_path:
        if os.path.exists(pdf_path) and not overwrite_existing:
            print(f"  [batch] PDF exists, skipping (overwrite_existing=False)")
        else:
            try:
                print(f"[process_batch_row] Exporting PDF to: {pdf_path}")
                worker.save_as(pdf_path, 3)
                pdf_saved = True
                print(f"[process_batch_row] PDF exported successfully")
            except Exception as e:
                print(f"[process_batch_row] WARNING: PDF export failed: {e}")

    # Export MCDX
    mcdx_saved = False
    if export_mcdx and mcdx_path:
        if os.path.exists(mcdx_path) and not overwrite_existing:
            print(f"  [batch] MCDX exists, skipping (overwrite_existing=False)")
        else:
            try:
                print(f"[process_batch_row] Exporting MCDX to: {mcdx_path}")
                worker.save_as(mcdx_path, 0)
                mcdx_saved = True
                print(f"[process_batch_row] MCDX exported successfully")
            except Exception as e:
                print(f"[process_batch_row] WARNING: MCDX export failed: {e}")

    # Get outputs if requested or if no files are being saved
    return_outputs = payload.get("return_outputs", False)
    units_map = payload.get("units_map", {})  # NEW
    print(f"[process_batch_row] units_map: {units_map}")

    if return_outputs or (not export_pdf and not export_mcdx):
        print(f"[process_batch_row] Fetching outputs...")
        output_names = worker.worksheet.outputs()
        output_data = {}
        for alias in output_names:
            try:
                requested_units = units_map.get(alias)
                if requested_units:
                    value, units, error_code = worker.worksheet.get_real_output(alias, units=requested_units)
                    if error_code != 0:
                        output_data[alias] = f"Error: ErrorCode {error_code}"
                    else:
                        output_data[alias] = value
                        print(f"[process_batch_row] Output '{alias}' = {value} (units: {units})")
                else:
                    value, units, error_code = worker.worksheet.get_real_output(alias)
                    if error_code != 0:
                        output_data[alias] = f"Error: ErrorCode {error_code}"
                    else:
                        output_data[alias] = value
                    print(f"[process_batch_row] Output '{alias}' = {output_data[alias]}")
            except Exception as e:
                output_data[alias] = f"Error: {str(e)}"
                print(f"[process_batch_row] Output '{alias}' ERROR: {e}")
    else:
        output_data = {}

    print(f"[process_batch_row] Complete. pdf_saved={pdf_saved}, mcdx_saved={mcdx_saved}, outputs={len(output_data)}")
    return {
        "outputs": output_data,
        "pdf_saved": pdf_saved,
        "mcdx_saved": mcdx_saved
    }


# Dispatch table: maps command names to handler functions
COMMAND_HANDLERS: Dict[str, Callable[[MathcadWorker, Dict[str, Any]], Dict[str, Any]]] = {
    "ping": handle_ping,
    "connect": handle_connect,
    "save_as": handle_save_as,
    "load_file": handle_load_file,
    "get_metadata": handle_get_metadata,
    "calculate_job": handle_calculate_job,
    "workflow_step": handle_workflow_step,
    "workflow_clear": handle_workflow_clear,
    "workflow_list": handle_workflow_list,
    "workflow_save_as": handle_workflow_save_as,
    "workflow_validate": handle_workflow_validate,
    "workflow_get_inputs": handle_workflow_get_inputs,
    "evaluate_row": handle_evaluate_row,
    "process_batch_row": handle_process_batch_row,
}


def run_harness(input_queue: multiprocessing.Queue, output_queue: multiprocessing.Queue):
    """
    The entry point for the sidecar process.

    Uses a dispatch table to route commands to their handlers.
    All COM operations stay on this single thread.
    """
    print(f"[harness] Process started. PID: {os.getpid()}")

    worker = MathcadWorker()
    consecutive_critical_errors = 0
    max_consecutive_critical_errors = 3

    while True:
        try:
            # Blocking get with timeout
            try:
                job_data = input_queue.get(timeout=0.5)
            except Empty:
                continue

            # Check for exit signal
            if job_data is None:
                print("[harness] Received exit signal. Shutting down.")
                break

            # Parse job
            if not isinstance(job_data, JobRequest):
                print(f"[harness] ERROR: Invalid job data type: {type(job_data)}")
                result = JobResult(
                    job_id="unknown",
                    status="error",
                    error_message=f"Invalid job data type: {type(job_data)}"
                )
                output_queue.put(result)
                continue

            job: JobRequest = job_data
            print(f"[harness] === Processing job: {job.id} | command: {job.command} | payload keys: {list(job.payload.keys())} ===")
            job_start = time.time()

            try:
                # Look up handler in dispatch table
                handler = COMMAND_HANDLERS.get(job.command)

                if handler is None:
                    print(f"[harness] Unknown command: {job.command}")
                    result = JobResult(
                        job_id=job.id,
                        status="error",
                        error_message=f"Unknown command: {job.command}"
                    )
                else:
                    # Execute handler
                    data = handler(worker, job.payload)
                    result = JobResult(
                        job_id=job.id,
                        status="success",
                        data=data
                    )

                elapsed = time.time() - job_start
                print(f"[harness] === Job {job.id} ({job.command}) completed in {elapsed:.2f}s ===")
                output_queue.put(result)
                consecutive_critical_errors = 0

            except Exception as e:
                # Catch job-processing errors
                elapsed = time.time() - job_start
                err_msg = "".join(traceback.format_exception(None, e, e.__traceback__))
                print(f"[harness] === Job {job.id} ({job.command}) FAILED after {elapsed:.2f}s ===")
                print(f"[harness] Error: {err_msg}")
                result = JobResult(
                    job_id=job.id,
                    status="error",
                    error_message=err_msg
                )
                output_queue.put(result)

        except KeyboardInterrupt:
            print("[harness] Caught KeyboardInterrupt. Exiting.")
            break
        except Exception as e:
            consecutive_critical_errors += 1
            print(f"[harness] CRITICAL ERROR: {e}")
            traceback.print_exc()
            if consecutive_critical_errors >= max_consecutive_critical_errors:
                print(
                    "[harness] Too many consecutive critical errors "
                    f"({consecutive_critical_errors}). Terminating harness."
                )
                break
            time.sleep(1)
