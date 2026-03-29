"""Batch manager for running multiple calculations."""

import threading
import os
import logging
import re
from pathlib import Path
from typing import List, Dict, Any, Optional, TYPE_CHECKING, Literal

if TYPE_CHECKING:
    from engine.manager import EngineManager
else:
    # Runtime import to avoid circular dependency
    def _get_engine_manager():
        from engine.manager import EngineManager
        return EngineManager

from engine.protocol import JobResult, InputConfig
from engine.settings import settings
from src.engine.state_persistence.batch_state import BatchStateManager

logger = logging.getLogger(__name__)


class BatchManager:
    """Manages batch calculation execution."""

    def __init__(self, engine_manager: "EngineManager"):
        self.engine = engine_manager
        self.batches: Dict[str, Dict[str, Any]] = {}
        self.stop_events: Dict[str, threading.Event] = {}
        self.state_manager = BatchStateManager()

    @staticmethod
    def _resolve_output_dir(
        output_dir: Optional[str],
        output_dir_mode: Optional[Literal["working", "source", "custom"]] = None,
        source_file_path: Optional[str] = None,
    ) -> str:
        """Resolve output directory according to selected mode."""
        workspace_root = Path.cwd().resolve()

        if output_dir_mode == "working":
            return str(workspace_root)

        if output_dir_mode == "source":
            if not source_file_path:
                raise ValueError("source_file_path is required when output_dir_mode='source'")
            return str(Path(source_file_path).resolve().parent)

        if output_dir_mode == "custom":
            if not output_dir:
                raise ValueError("output_dir is required when output_dir_mode='custom'")
            raw = Path(output_dir)
            return str(raw.resolve() if raw.is_absolute() else (workspace_root / raw).resolve())

        if not output_dir:
            raise ValueError("output_dir is required")

        raw = Path(output_dir)
        resolved = raw.resolve() if raw.is_absolute() else (workspace_root / raw).resolve()

        return str(resolved)

    def start_batch(
        self,
        batch_id: str,
        inputs_list: List[Dict[str, Any]],
        output_dir: Optional[str],
        export_pdf: bool = False,
        export_mcdx: bool = False,
        mode: str = 'combination',
        output_units: Dict[str, str] = None,
        overwrite_existing: bool = None,
        output_dir_mode: Optional[Literal["working", "source", "custom"]] = None,
        source_file_path: Optional[str] = None,
    ):
        if overwrite_existing is None:
            overwrite_existing = settings.overwrite_existing

        output_dir = self._resolve_output_dir(
            output_dir,
            output_dir_mode=output_dir_mode,
            source_file_path=source_file_path,
        )
        if not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)

        logger.info(f"Batch {batch_id} starting with mode={mode}, {len(inputs_list)} iterations, overwrite_existing={overwrite_existing}")

        self.batches[batch_id] = {
            "id": batch_id,
            "total": len(inputs_list),
            "completed": 0,
            "results": [],
            "generated_files": [],
            "status": "running",
            "error": None,
            "mode": mode,
            "output_units": output_units or {}
        }
        self.stop_events[batch_id] = threading.Event()

        thread = threading.Thread(
            target=self._process_batch,
            args=(batch_id, inputs_list, output_dir, export_pdf, export_mcdx, mode, output_units, overwrite_existing),
            daemon=True
        )
        thread.start()

    def _process_batch(self, batch_id: str, inputs_list: List[Dict[str, Any]], output_dir: str,
                       export_pdf: bool, export_mcdx: bool, mode: str = 'combination',
                       output_units: Dict[str, str] = None, overwrite_existing: bool = True):
        batch = self.batches[batch_id]
        stop_event = self.stop_events.get(batch_id)

        def sanitize(s: str) -> str:
            return re.sub(r'[<>:"/\\|?*]', '_', str(s))

        # Helper to update execution stage for current row
        def update_stage(row_idx, stage_msg):
            # Check if we already have a partial result for this row, if so update it
            # Otherwise create a new pending result
            found = False
            for res in batch["results"]:
                if res["row"] == row_idx:
                    res["stage"] = stage_msg
                    found = True
                    break
            if not found:
                batch["results"].append({
                    "row": row_idx,
                    "status": "running",
                    "stage": stage_msg
                })

        for i, row_input in enumerate(inputs_list):
            if batch["status"] == "stopped" or (stop_event and stop_event.is_set()):
                break

            success = False
            retries = 1
            while not success and retries >= 0:
                try:
                    update_stage(i, "Processing...")

                    # 1. Prepare paths and inputs
                    path = row_input.get("path")
                    base_name = os.path.splitext(os.path.basename(path))[0]

                    # Extract input configs and build suffix for filename
                    input_configs = []
                    suffix_parts = []
                    for k, v in row_input.items():
                        if k == "path":
                            continue

                        val = v["value"] if isinstance(v, dict) and "value" in v else v
                        units = v.get("units") if isinstance(v, dict) else None

                        input_configs.append(InputConfig(alias=k, value=val, units=units))
                        suffix_parts.append(f"{sanitize(k)}-{sanitize(val)}")

                    filename_base = f"{base_name}_{'_'.join(suffix_parts)}" if suffix_parts else f"{base_name}_{i}"

                    # Prepare export paths and cleanup existing files
                    pdf_path = None
                    mcdx_path = None

                    if export_pdf:
                        pdf_path = os.path.join(output_dir, f"{filename_base}.pdf")
                        if os.path.exists(pdf_path) and not overwrite_existing:
                            print(f"  [batch] PDF exists, skipping (overwrite_existing=False)")
                            pdf_path = None  # signal: do not export
                        elif os.path.exists(pdf_path):
                            try:
                                os.remove(pdf_path)
                            except Exception as cleanup_err:
                                logger.warning(
                                    "Batch %s row %s failed to remove PDF '%s': %s",
                                    batch_id,
                                    i,
                                    pdf_path,
                                    cleanup_err,
                                )

                    if export_mcdx:
                        mcdx_path = os.path.join(output_dir, f"{filename_base}.mcdx")
                        if os.path.exists(mcdx_path) and not overwrite_existing:
                            print(f"  [batch] MCDX exists, skipping (overwrite_existing=False)")
                            mcdx_path = None  # signal: do not export
                        elif os.path.exists(mcdx_path):
                            try:
                                os.remove(mcdx_path)
                            except Exception as cleanup_err:
                                logger.warning(
                                    "Batch %s row %s failed to remove MCDX '%s': %s",
                                    batch_id,
                                    i,
                                    mcdx_path,
                                    cleanup_err,
                                )

                    # 2. Submit single unified job
                    job_payload = {
                        "path": path,
                        "inputs": input_configs,
                        "export_pdf": export_pdf,
                        "pdf_path": pdf_path,
                        "export_mcdx": export_mcdx,
                        "mcdx_path": mcdx_path,
                        "units_map": output_units or {},
                        "return_outputs": True,  # Always fetch computed outputs
                        "overwrite_existing": overwrite_existing
                    }

                    # Increased timeout to account for combined operations (calc + save + save)
                    job_id = self.engine.submit_job("process_batch_row", job_payload)
                    result = self._poll_result(job_id, timeout=600.0)

                    if result and result.status == "success":
                        # 3. Handle success
                        output_data = result.data.get("outputs", {})
                        pdf_saved = result.data.get("pdf_saved")
                        mcdx_saved = result.data.get("mcdx_saved")

                        if pdf_saved and pdf_path:
                            batch["generated_files"].append(pdf_path)

                        if mcdx_saved and mcdx_path:
                            batch["generated_files"].append(mcdx_path)

                        # Build inputs dict excluding 'path' key
                        input_values = {k: v for k, v in row_input.items() if k != "path"}

                        # Finalize row
                        for res in batch["results"]:
                            if res["row"] == i:
                                res.update({
                                    "status": "success",
                                    "stage": "Completed",
                                    "inputs": input_values,
                                    "data": output_data,
                                    "pdf": pdf_path if pdf_saved else None,
                                    "mcdx": mcdx_path if mcdx_saved else None
                                })
                                break

                        batch["completed"] += 1
                        success = True
                        logger.debug(f"Batch {batch_id} Row {i} completed with inputs: {list(input_values.keys())}")

                        # Checkpoint state every 5 iterations
                        if batch["completed"] % 5 == 0:
                            try:
                                self.state_manager.save_state(batch_id, batch)
                                logger.info(f"Batch {batch_id} checkpoint saved: {batch['completed']}/{batch['total']} completed")
                            except Exception as e:
                                logger.warning(f"Failed to save batch checkpoint for {batch_id}: {e}")
                    else:
                        raise Exception(result.error_message if result else "Job timeout")
                except Exception as e:
                    print(f"Batch {batch_id} Row {i} failed: {e}")
                    retries -= 1
                    if retries >= 0:
                        update_stage(i, "Retrying (Engine Restart)...")
                        print("Retrying connection (then restart if needed)...")
                        try:
                            conn_job = self.engine.submit_job("connect")
                            conn_result = self._poll_result(conn_job, timeout=15.0)
                            if conn_result and conn_result.status == "success":
                                continue

                            self.engine.restart_engine()
                            conn_job = self.engine.submit_job("connect")
                            conn_result = self._poll_result(conn_job)
                            if not conn_result or conn_result.status != "success":
                                raise RuntimeError(
                                    conn_result.error_message
                                    if conn_result and conn_result.error_message
                                    else "Engine reconnect failed after restart"
                                )
                        except Exception as restart_err:
                            logger.error(
                                "Batch %s row %s restart/reconnect failed: %s",
                                batch_id,
                                i,
                                restart_err,
                            )
                            retries = -1
                            e = RuntimeError(
                                f"{e}; restart/reconnect failed: {restart_err}"
                            )
                    else:
                        # Update existing entry to failed
                        for res in batch["results"]:
                            if res["row"] == i:
                                res.update({
                                    "status": "failed",
                                    "stage": "Failed",
                                    "error": str(e)
                                })
                                break
                        batch["completed"] += 1
                        success = True

        if batch["status"] == "running":
            batch["status"] = "completed"
            # Clean up state file on successful completion
            try:
                self.state_manager.delete_state(batch_id)
                logger.info(f"Batch {batch_id} state checkpoint cleaned up")
            except Exception as e:
                logger.warning(f"Failed to clean up batch state checkpoint for {batch_id}: {e}")
        self.stop_events.pop(batch_id, None)

    def _poll_result(self, job_id: str, timeout: float = 30.0) -> Optional[JobResult]:
        """Wait for job result using engine manager blocking wait."""
        return self.engine.wait_for_result(job_id, timeout=timeout)

    def get_status(self, batch_id: str) -> Optional[Dict[str, Any]]:
        return self.batches.get(batch_id)

    def stop_batch(self, batch_id: str):
        if batch_id in self.batches:
            self.batches[batch_id]["status"] = "stopped"
            stop_event = self.stop_events.get(batch_id)
            if stop_event:
                stop_event.set()
