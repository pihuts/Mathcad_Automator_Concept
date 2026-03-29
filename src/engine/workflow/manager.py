import threading
import time
import traceback
import html
import csv
from dataclasses import asdict
from datetime import datetime
import json
import re
from pathlib import Path
from typing import List, Dict, Any, Optional, TYPE_CHECKING
import sys
import os
import itertools

from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

try:
    from engine.protocol import (
        WorkflowConfig, WorkflowState, WorkflowStatus,
        InputConfig, FileMapping,
        ConditionalTermination, RetryConfig, FailureMode, PauseMode,
        StepStatus, StepResult, WorkflowCsvTable, CheckpointData, AggregationMapping,
    )
    from engine.mapping_suggester import MappingSuggester
    from engine.dag_validator import validate_workflow_dag
except ModuleNotFoundError:
    current_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(current_dir)
    if parent_dir not in sys.path:
        sys.path.insert(0, parent_dir)
    from engine.protocol import (
        WorkflowConfig, WorkflowState, WorkflowStatus,
        InputConfig, FileMapping,
        ConditionalTermination, RetryConfig, FailureMode, PauseMode,
        StepStatus, StepResult, WorkflowCsvTable, CheckpointData, AggregationMapping,
    )
    from engine.mapping_suggester import MappingSuggester
    from engine.dag_validator import validate_workflow_dag
from .checkpoint import CheckpointManager


class WorkflowManager:
    EXPERIMENTAL_INPUT_ALIAS = "experimental_input"
    MAX_RETAINED_FINISHED_WORKFLOWS = 50

    def __init__(self, engine_manager):
        self.engine = engine_manager
        self.workflows: Dict[str, WorkflowState] = {}
        self.pause_events: Dict[str, threading.Event] = {}
        self._finished_workflow_ids: List[str] = []
        self.checkpoint_mgr = CheckpointManager()
        self.suggester = MappingSuggester()

    @staticmethod
    def _decode_variable_reference(ref: str) -> str:
        """
        Decode a variable reference that may contain source information.

        Frontend encodes variable references as 'alias@@source' to preserve
        which step a variable came from when aliases can be duplicated.
        The backend only needs the alias for variable lookup.

        Args:
            ref: Variable reference, possibly encoded as 'alias@@source'

        Returns:
            Just the alias portion
        """
        if not ref:
            return ref
        if '@@' in ref:
            return ref.split('@@')[0]
        return ref

    @staticmethod
    def _value_identity_key(value: Any) -> str:
        """Create a stable identity key for deduplication while preserving order."""
        try:
            return json.dumps(value, sort_keys=True, default=str)
        except Exception:
            return repr(value)

    @classmethod
    def _dedupe_preserve_order(cls, values: List[Any]) -> List[Any]:
        """Deduplicate values while preserving first-seen order."""
        seen = set()
        deduped: List[Any] = []
        for value in values:
            key = cls._value_identity_key(value)
            if key in seen:
                continue
            seen.add(key)
            deduped.append(value)
        return deduped

    @staticmethod
    def _safe_slug(value: str, fallback: str = "step") -> str:
        """Convert labels/filenames to deterministic filesystem-safe slugs."""
        candidate = re.sub(r"[^A-Za-z0-9]+", "-", (value or "").strip())
        candidate = re.sub(r"-{2,}", "-", candidate).strip("-").lower()
        return candidate or fallback

    @staticmethod
    def _safe_filename_part(value: Any) -> str:
        """Convert values to readable filesystem-safe filename fragments."""
        text = str(value)
        sanitized = re.sub(r'[<>:"/\\|?*]', "_", text)
        sanitized = re.sub(r"\s+", "-", sanitized.strip())
        sanitized = re.sub(r"-{2,}", "-", sanitized).strip("-_.")
        return sanitized or "value"

    @classmethod
    def _step_has_experimental_input(cls, file_config) -> bool:
        return any(inp.alias == cls.EXPERIMENTAL_INPUT_ALIAS for inp in file_config.inputs)

    @staticmethod
    def _get_experimental_epoch_ms(state: WorkflowState, combo_idx: int) -> int:
        if not hasattr(state, "_experimental_epoch_ms"):
            state._experimental_epoch_ms = {}
        if combo_idx not in state._experimental_epoch_ms:
            state._experimental_epoch_ms[combo_idx] = int(time.time() * 1000)
        return state._experimental_epoch_ms[combo_idx]

    @classmethod
    def build_experimental_location(
        cls,
        workflow_name: str,
        iteration_index: int,
        step_file_path: str,
        epoch_ms: int,
        base_dir: Optional[str] = None,
    ) -> str:
        workflow_slug = cls._safe_slug(workflow_name or "workflow", fallback="workflow")
        step_slug = cls._safe_slug(Path(step_file_path).stem or "step", fallback="step")
        folder = f"{workflow_slug}_{iteration_index}_{epoch_ms}"
        location = os.path.join(folder, step_slug)

        if base_dir:
            root = os.path.join(base_dir, "_void")
            candidate = location
            suffix = 1
            while os.path.exists(os.path.join(root, candidate)):
                candidate = os.path.join(folder, f"{step_slug}_{suffix:02d}")
                suffix += 1
            location = candidate

        return location.replace(os.sep, "/")

    @staticmethod
    def collect_experimental_csv_tables(base_dir: str, location: str) -> List["WorkflowCsvTable"]:
        csv_dir = Path(base_dir) / "_void" / location
        if not csv_dir.exists():
            return []

        tables: List["WorkflowCsvTable"] = []
        csv_paths = sorted(csv_dir.glob("*.csv"), key=lambda p: p.name.lower())
        for csv_path in csv_paths:
            with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
                reader = csv.reader(handle)
                rows = list(reader)
            headers = rows[0] if rows else []
            data_rows = rows[1:] if len(rows) > 1 else []
            tables.append(WorkflowCsvTable(
                path=str(csv_path),
                name=csv_path.name,
                headers=headers,
                rows=data_rows,
            ))
        return tables

    def _poll_experimental_csv_tables(
        self,
        base_dir: str,
        location: str,
        attempts: int = 2,
        delay: float = 0.1,
    ) -> tuple[List["WorkflowCsvTable"], Optional[str]]:
        csv_dir = Path(base_dir) / "_void" / location
        for attempt in range(attempts):
            tables = self.collect_experimental_csv_tables(base_dir, location)
            if tables:
                return tables, None
            if attempt < attempts - 1:
                time.sleep(delay * (2 ** attempt))
        if not csv_dir.exists():
            return [], f"CSV output missing at _void/{location}"
        return [], f"No CSV files found in _void/{location}"

    def _resolve_run_root(self, state: WorkflowState) -> str:
        """Resolve and create a single run root directory for this workflow execution."""
        if getattr(state, "_run_root_dir", None):
            return state._run_root_dir

        workspace_root = Path.cwd().resolve()
        mode = state.config.output_dir_mode
        if mode in ("source", "working"):
            # Files land in the same directory as the first source file
            if state.config.files:
                base_dir = os.path.dirname(os.path.abspath(state.config.files[0].file_path))
            else:
                base_dir = os.getcwd()
        elif mode == "custom":
            custom_dir = Path(state.config.output_dir or "results")
            if custom_dir.is_absolute():
                base_dir = str(custom_dir.resolve())
            else:
                resolved_custom = (workspace_root / custom_dir).resolve()
                try:
                    resolved_custom.relative_to(workspace_root)
                except ValueError as exc:
                    raise ValueError(
                        f"Relative custom output_dir escapes workspace root: {state.config.output_dir}"
                    ) from exc
                base_dir = str(resolved_custom)
            try:
                Path(base_dir).resolve().relative_to(workspace_root)
            except ValueError as exc:
                raise ValueError(
                    f"Custom output_dir escapes workspace root: {state.config.output_dir}"
                ) from exc
        else:
            # Fallback: preserve old behavior (timestamp folder) when no mode set
            output_dir = Path(state.config.output_dir or "results")
            timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
            if output_dir.is_absolute():
                base_dir = str((output_dir / timestamp).resolve())
            else:
                resolved_parent = (workspace_root / output_dir).resolve()
                try:
                    resolved_parent.relative_to(workspace_root)
                except ValueError as exc:
                    raise ValueError(
                        f"Relative output_dir escapes workspace root: {state.config.output_dir}"
                    ) from exc
                base_dir = str((resolved_parent / timestamp).resolve())
            try:
                Path(base_dir).resolve().relative_to(workspace_root)
            except ValueError as exc:
                raise ValueError(
                    f"output_dir escapes workspace root: {state.config.output_dir}"
                ) from exc

        os.makedirs(base_dir, exist_ok=True)
        state._run_root_dir = base_dir
        state._run_id = getattr(state, "_run_id", os.path.basename(base_dir))
        return base_dir

    def _build_iteration_name(
        self,
        combo_idx: int,
        combination_inputs: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Build deterministic iteration directory name with readable input_name-value pairs."""
        if not combination_inputs:
            return f"combo-{combo_idx:03d}"

        parts = []
        for alias, value in combination_inputs.items():
            alias_part = self._safe_filename_part(alias)
            value_part = self._safe_filename_part(value)
            if alias_part and value_part:
                parts.append(f"step no. {alias_part} - {value_part}")
            elif alias_part:
                parts.append(f"step no. {alias_part}")
            elif value_part:
                parts.append(f"step no. {value_part}")
            else:
                parts.append("step no. value")

        if not parts:
            return f"combo-{combo_idx:03d}"

        # Keep names readable and path-safe on Windows.
        suffix = " ".join(parts)
        max_suffix_len = 96
        if len(suffix) > max_suffix_len:
            suffix = suffix[:max_suffix_len].rstrip("-_.")
        return suffix

    def _iteration_name_has_input_suffix(
        self,
        combination_inputs: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Return whether provided combination inputs can contribute readable suffix parts."""
        if not combination_inputs:
            return False
        for alias, value in combination_inputs.items():
            if self._safe_filename_part(alias) and self._safe_filename_part(value):
                return True
        return False

    def _get_iteration_context(
        self,
        state: WorkflowState,
        combo_idx: int,
        combination_inputs: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Return the base run directory as iteration context (no subdirectory nesting)."""
        if not hasattr(state, "_iteration_contexts"):
            state._iteration_contexts = {}

        existing = state._iteration_contexts.get(combo_idx)
        if existing:
            return existing

        run_root = self._resolve_run_root(state)
        run_id = getattr(state, "_run_id", os.path.basename(run_root.rstrip(os.sep)) or "run")
        context = {
            "combo_idx": combo_idx,
            # Must be unique per combination so frontend can map created files to the right iteration.
            "iteration_id": f"{run_id}::iter-{combo_idx:04d}",
            "iteration_dir": run_root,
            "has_input_suffix": self._iteration_name_has_input_suffix(combination_inputs),
        }
        state._iteration_contexts[combo_idx] = context
        return context

    @staticmethod
    def _resolve_effective_export_policy(state: WorkflowState, file_config) -> Dict[str, bool]:
        """Resolve per-step export policy with workflow-global fallback."""
        effective_pdf = file_config.save_pdf if file_config.save_pdf is not None else state.config.export_pdf
        effective_mcdx = file_config.save_mcdx if file_config.save_mcdx is not None else state.config.export_mcdx
        return {"pdf": bool(effective_pdf), "mcdx": bool(effective_mcdx)}

    @staticmethod
    def _make_input_key(inp, file_config, config) -> str:
        """Build qualified key for input dict and filename suffix.

        Upstream inputs (inp.source set) â†’ 'N.alias'
        Direct inputs â†’ 'alias'
        """
        if inp.source:
            # Upstream input â€” find source step position (1-indexed)
            for i, f in enumerate(config.files):
                if f.file_path == inp.source:
                    return f"{i + 1}.{inp.alias}"
            return inp.alias  # fallback
        return inp.alias

    def _build_export_filename_base(
        self,
        file_config,
        idx: int,
        combo_idx: int,
        combination_inputs: Optional[Dict[str, Any]] = None,
        resolved_inputs: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Build export filename with input value suffixes.

        Direct inputs â†’ alias-value (e.g. width-50)
        Upstream inputs â†’ alias-value UNLESS same alias from multiple upstream steps
        Conflict case â†’ N.alias-value for each conflicting source
        """
        values = resolved_inputs if resolved_inputs is not None else combination_inputs
        base_name = self._safe_filename_part(Path(file_config.file_path).stem)

        # Collect bare aliases and detect conflicts
        # key: bare_alias â†’ list of (qualified_key, value) for upstream inputs
        upstream_by_alias: Dict[str, List[tuple]] = {}
        direct_aliases = set()

        for key, value in (values or {}).items():
            if key == "iteration_id":
                continue
            if "." in key:
                # Upstream input: qualified key like "1.stress_result"
                parts = key.split(".", 1)
                bare = parts[1]
                if bare not in upstream_by_alias:
                    upstream_by_alias[bare] = []
                upstream_by_alias[bare].append((key, value))
            else:
                # Direct input
                direct_aliases.add(key)

        # Determine which upstream aliases are conflicting (multiple sources)
        conflicting_bare_aliases = {bare for bare, sources in upstream_by_alias.items() if len(sources) > 1}

        # Build suffix parts
        suffix_parts = []

        # Direct inputs first
        for key, value in (values or {}).items():
            if key == "iteration_id":
                continue
            if key == self.EXPERIMENTAL_INPUT_ALIAS:
                continue
            if "." not in key and key in direct_aliases:
                suffix_parts.append(f"{self._safe_filename_part(key)}-{self._safe_filename_part(value)}")

        # Upstream inputs â€” strip N. prefix unless conflicting
        for bare_alias, sources in upstream_by_alias.items():
            if bare_alias == self.EXPERIMENTAL_INPUT_ALIAS:
                continue
            if len(sources) == 1:
                # No conflict â€” use bare alias
                _, value = sources[0]
                suffix_parts.append(f"{self._safe_filename_part(bare_alias)}-{self._safe_filename_part(value)}")
            else:
                # Conflict â€” keep qualified form for each
                for qualified_key, value in sources:
                    step_num = qualified_key.split(".", 1)[0]
                    suffix_parts.append(f"{self._safe_filename_part(qualified_key)}-{self._safe_filename_part(value)}")

        suffix = f"_{'_'.join(suffix_parts)}" if suffix_parts else ""
        return f"{idx + 1}.{base_name}{suffix}"

    def _resolve_step_dir(self, state: WorkflowState, file_config, idx: int, combo_idx: int) -> str:
        """Compatibility helper: step exports now write directly into the iteration directory."""
        return self._get_iteration_context(state, combo_idx)["iteration_dir"]

    def get_incomplete_workflows(self) -> List[Dict[str, Any]]:
        """Return list of workflows that can be resumed from checkpoint.

        Returns:
            List of dicts with workflow resume info:
            - workflow_id: Unique identifier
            - last_step_index: Current step index (0-based)
            - total_steps: Total number of steps in workflow
            - step_results_count: Number of completed steps
        """
        checkpoint_ids = self.checkpoint_mgr.list_checkpoints()
        incomplete = []
        for workflow_id in checkpoint_ids:
            checkpoint = self.checkpoint_mgr.load_checkpoint(workflow_id)
            if checkpoint:
                incomplete.append({
                    "workflow_id": workflow_id,
                    "last_step_index": checkpoint.current_step_index,
                    "total_steps": len(checkpoint.config.files),
                    "step_results_count": len(checkpoint.step_results),
                })
        return incomplete

    def submit_workflow(self, workflow_id: str, config: WorkflowConfig) -> str:
        """Submit a workflow for execution in background thread.

        Validates DAG structure before execution to reject circular dependencies.

        Args:
            workflow_id: Unique identifier for this workflow
            config: Workflow configuration

        Returns:
            workflow_id

        Raises:
            ValueError: If circular dependency detected in workflow mappings
        """
        # Validate DAG structure - reject circular dependencies before execution
        validate_workflow_dag(config)

        state = WorkflowState(workflow_id=workflow_id, config=config)
        # Initialize step_results as empty list
        state.step_results = []
        self.workflows[workflow_id] = state
        if workflow_id in self._finished_workflow_ids:
            self._finished_workflow_ids.remove(workflow_id)

        # Create pause event for this workflow
        pause_event = threading.Event()
        # Set initial state based on pause_mode
        if config.pause_mode == "auto_run":
            pause_event.set()  # Running
        else:  # pause_each
            pause_event.set()  # Start running, will auto-pause after first step
        self.pause_events[workflow_id] = pause_event

        thread = threading.Thread(
            target=self._execute_workflow,
            args=(workflow_id,),
            daemon=True
        )
        thread.start()
        return workflow_id

    def submit_workflow_from_checkpoint(self, workflow_id: str) -> str:
        """Resume workflow from checkpoint"""
        checkpoint = self.checkpoint_mgr.load_checkpoint(workflow_id)
        if not checkpoint:
            raise ValueError(f"No checkpoint found for workflow {workflow_id}")

        # Create state from checkpoint
        state = WorkflowState(workflow_id=workflow_id, config=checkpoint.config)
        state.current_file_index = checkpoint.current_step_index
        state.step_results = checkpoint.step_results
        state.intermediate_results = checkpoint.intermediate_results
        state.intermediate_details = getattr(checkpoint, "intermediate_details", {})
        # Set completed_files from step_results
        state.completed_files = [
            sr.file_path for sr in state.step_results
            if sr.status == StepStatus.COMPLETED
        ]
        self.workflows[workflow_id] = state

        # Create pause event
        pause_event = threading.Event()
        pause_event.set()  # Start running
        self.pause_events[workflow_id] = pause_event

        # Start execution from checkpoint step
        thread = threading.Thread(
            target=self._execute_workflow,
            args=(workflow_id, checkpoint.current_step_index),
            daemon=True
        )
        thread.start()
        return workflow_id

    def _execute_workflow(self, workflow_id: str, start_from: int = 0):
        """Execute workflow in linear order (0,1,2...) with enhanced features.

        Supports input combinations: if any workflow step has arrays of input values,
        generates all cartesian product combinations and executes the workflow for each.
        """
        print(f"\n{'='*80}")
        print(f"WORKFLOW EXECUTION START: {workflow_id}")
        print(f"{'='*80}")

        state = self.workflows[workflow_id]
        state.status = WorkflowStatus.RUNNING
        state.export_manifest = []  # Initialize export tracking
        state._run_root_dir = None
        state._run_id = None
        state._iteration_contexts = {}
        state._exported_keys = set()
        state._iteration_completed_steps = {}
        state._run_manifest_entries = []
        state._manifest_entry_index = {}
        pause_event = self.pause_events[workflow_id]

        # --- COMBINATION GENERATION ---
        print(f"\n[1] GENERATING INPUT COMBINATIONS...")
        # Check if any file has multi-value inputs (arrays)
        iteration_mode = getattr(state.config, "iteration_mode", "combination") or "combination"
        combinations = self._generate_workflow_combinations(state.config.files, iteration_mode)

        print(f"   Ã¢Å“â€œ Generated {len(combinations)} combination(s)")
        if len(combinations) > 1:
            print(f"   Ã¢â€ â€™ Workflow has {len(combinations)} input combinations to process")
        state.total_iterations = len(combinations)
        state.completed_iterations = 0
        state.current_iteration = 0

        # Execute workflow for each combination
        for combo_idx, combination in enumerate(combinations, 1):
            state.current_iteration = combo_idx
            print(f"\n{'='*80}")
            print(f"[2] EXECUTING COMBINATION {combo_idx}/{len(combinations)}")
            print(f"{'='*80}")
            if len(combinations) > 1:
                # Show which values are being used for this combination
                for file_idx, file_inputs in enumerate(combination):
                    file_path = state.config.files[file_idx].file_path
                    print(f"   Step {file_idx + 1} ({Path(file_path).name}): {file_inputs}")

            # Execute all workflow steps with this combination
            self._execute_workflow_combination(
                workflow_id, combination, combo_idx, len(combinations), start_from
            )

            # Check if stopped
            if state.status == WorkflowStatus.STOPPED:
                state.completed_iterations = max(0, combo_idx - 1)
                break

            state.completed_iterations = combo_idx

        # Final status
        if state.status == WorkflowStatus.RUNNING:
            state.status = WorkflowStatus.COMPLETED
            state.final_results = state.intermediate_results
            # Clean up checkpoint on success
            self.checkpoint_mgr.delete_checkpoint(workflow_id)

        if getattr(state, "_run_manifest_entries", None):
            print(f"\n[7] WRITING RUN MANIFEST...")
            self._write_run_manifest(state)
            print(f"[7] GENERATING TABLE OF CONTENTS...")
            self._generate_table_of_contents(state)

        print(f"\n{'='*80}")
        print(f"WORKFLOW EXECUTION COMPLETE: {state.status.value}")
        print(f"{'='*80}\n")
        self._record_finished_workflow(workflow_id)

    def _generate_workflow_combinations(self, files: List, mode: str = "combination") -> List[List[Dict]]:
        """Generate all combinations of input values across workflow files.

        Returns: List of combinations, where each combination is a list of
                 input dicts (one per file in workflow)

        Example:
          File 1: Nr=[1,2], Sr=[3,4]
          File 2: Beam=[5,6]

          Returns: [
            [{Nr:1, Sr:3}, {Beam:5}],  # Combination 1
            [{Nr:1, Sr:3}, {Beam:6}],  # Combination 2
            [{Nr:1, Sr:4}, {Beam:5}],  # Combination 3
            [{Nr:1, Sr:4}, {Beam:6}],  # Combination 4
            [{Nr:2, Sr:3}, {Beam:5}],  # Combination 5
            [{Nr:2, Sr:3}, {Beam:6}],  # Combination 6
            [{Nr:2, Sr:4}, {Beam:5}],  # Combination 7
            [{Nr:2, Sr:4}, {Beam:6}],  # Combination 8
          ]
        """
        print(f"\n[DEBUG _generate_workflow_combinations] Called with mode: {mode}, files count: {len(files)}")
        file_combinations = []

        for file_config in files:
            step_mode = getattr(file_config, "mode", None) or mode or "combination"
            if step_mode not in {"combination", "zip"}:
                step_mode = "combination"
            print(f"[DEBUG _generate_workflow_combinations] Processing file: {file_config.file_path}, inputs: {file_config.inputs}")
            print(f"[DEBUG _generate_workflow_combinations]   effective_step_mode={step_mode}")
            # For each input in this file, collect its values
            input_value_lists = []
            input_aliases = []

            for inp in file_config.inputs:
                print(f"[DEBUG _generate_workflow_combinations]   inp.alias={inp.alias!r}, inp.value={inp.value!r}, type(inp.value)={type(inp.value).__name__}")
                input_aliases.append(inp.alias)
                # If value is a list/array, filter out None values; otherwise wrap in list
                if isinstance(inp.value, list):
                    # Filter None values from lists (e.g., [None, 1, 2] becomes [1, 2])
                    filtered = [v for v in inp.value if v is not None]
                    print(f"[DEBUG _generate_workflow_combinations]   -> value is list, appending {filtered} (filtered from {inp.value})")
                    input_value_lists.append(filtered)
                elif inp.value is None:
                    # None means no direct value (likely mapped from upstream) - treat as empty
                    print(f"[DEBUG _generate_workflow_combinations]   -> value is None, treating as empty list")
                    input_value_lists.append([])
                else:
                    print(f"[DEBUG _generate_workflow_combinations]   -> value is NOT list, wrapping in list: [{inp.value}]")
                    input_value_lists.append([inp.value])

            print(f"[DEBUG _generate_workflow_combinations]   input_aliases={input_aliases}, input_value_lists={input_value_lists}")

            configured_aliases = [alias for alias, values in zip(input_aliases, input_value_lists) if len(values) > 0]
            configured_value_lists = [values for values in input_value_lists if len(values) > 0]

            if not input_value_lists:
                print(f"[DEBUG _generate_workflow_combinations]   -> No inputs, using [{{}}]")
                file_combos = [{}]  # No inputs
            elif not configured_value_lists:
                # Inputs exist but all values are empty (typically mapped from upstream).
                print(f"[DEBUG _generate_workflow_combinations]   -> All input values empty, using [{{}}]")
                file_combos = [{}]
            elif step_mode == "zip":
                multi_lengths = [len(values) for values in configured_value_lists if len(values) > 1]
                if multi_lengths and any(length != multi_lengths[0] for length in multi_lengths):
                    details = ", ".join(
                        f"{alias}: {len(values)}"
                        for alias, values in zip(configured_aliases, configured_value_lists)
                        if len(values) > 1
                    )
                    raise ValueError(
                        f"Workflow zip mode requires equal multi-value input lengths per step. "
                        f"Step '{Path(file_config.file_path).name}' has: {details}"
                    )
                row_count = multi_lengths[0] if multi_lengths else 1
                file_combos = []
                seen_rows = set()
                for row_idx in range(row_count):
                    row = {}
                    for alias, values in zip(configured_aliases, configured_value_lists):
                        if len(values) > 1:
                            row[alias] = values[row_idx]
                        else:
                            row[alias] = values[0]
                    row_key = self._value_identity_key([row.get(alias) for alias in configured_aliases])
                    if row_key in seen_rows:
                        continue
                    seen_rows.add(row_key)
                    file_combos.append(row)
                print(
                    f"[DEBUG _generate_workflow_combinations]   -> Zip deduplicated {row_count} rows to {len(file_combos)} unique rows"
                )
            else:
                # Combination mode (default): cartesian product per step inputs.
                deduped_value_lists = [self._dedupe_preserve_order(values) for values in configured_value_lists]
                print(
                    f"[DEBUG _generate_workflow_combinations]   -> Combination mode, computing cartesian product of deduped values: {deduped_value_lists}"
                )
                # Handle case where all input value lists are empty (file receives values via mappings)
                # In this case, treat as a single empty combination since values come from passthrough
                if input_value_lists and all(len(v) == 0 for v in input_value_lists):
                    print(f"[DEBUG _generate_workflow_combinations]   -> All input values empty (mapped inputs), using [{{}}]")
                    file_combos = [{}]
                else:
                    file_combos = [
                        dict(zip(configured_aliases, combo))
                        for combo in itertools.product(*deduped_value_lists)
                    ]
                print(f"[DEBUG _generate_workflow_combinations]   -> Generated {len(file_combos)} file_combos: {file_combos[:3]}{'...' if len(file_combos) > 3 else ''}")

            file_combinations.append(file_combos)

        # Generate cartesian product across all files
        print(f"[DEBUG _generate_workflow_combinations] file_combinations has {len(file_combinations)} entries")
        for i, fc in enumerate(file_combinations):
            print(f"[DEBUG _generate_workflow_combinations]   file_combinations[{i}] has {len(fc)} combos")
        all_combinations = list(itertools.product(*file_combinations))
        print(f"[DEBUG _generate_workflow_combinations] Final all_combinations count: {len(all_combinations)}")

        return all_combinations

    def _execute_workflow_combination(
        self, workflow_id: str, combination: tuple, combo_idx: int, total_combos: int, start_from: int = 0
    ):
        """Execute all workflow steps for a single input combination."""
        state = self.workflows[workflow_id]
        pause_event = self.pause_events[workflow_id]

        total_steps = len(state.config.files)
        if start_from >= total_steps and total_steps > 0:
            print(
                f"[WARN] start_from={start_from} >= total_steps={total_steps}. "
                f"Resetting start_from to 0 to execute steps."
            )
            start_from = 0

        # Clear intermediate results for this combination
        print(f"[DEBUG] Clearing intermediate_results for combination {combo_idx}")
        state.intermediate_results = {}
        state.intermediate_details = {}

        print(f"\n[3] PROCESSING WORKFLOW STEPS...")
        print(
            f"[DEBUG] Step loop setup: total_steps={total_steps}, start_from={start_from}, "
            f"pause_mode={state.config.pause_mode}, failure_mode={state.config.failure_mode}"
        )

        # Build merged inputs from combination
        merged_combination_inputs = {}
        scoped_combination_inputs = {}
        for file_config, file_inputs in zip(state.config.files, combination):
            file_label = Path(file_config.file_path).name or str(file_config.file_path)
            for alias, value in file_inputs.items():
                merged_combination_inputs[alias] = value
                scoped_combination_inputs[f"{alias}@@{file_label} (input)"] = value
        self._get_iteration_context(state, combo_idx, merged_combination_inputs)
        state._iteration_completed_steps[combo_idx] = []

        # Execute steps sequentially
        for step_idx, file_config in enumerate(state.config.files):
            # Skip already-completed steps (resume from checkpoint)
            if step_idx < start_from:
                continue

            # --- PAUSE CHECK ---
            # If pause_each mode and not first step, auto-pause
            if state.config.pause_mode == "pause_each" and step_idx > start_from:
                state.status = WorkflowStatus.PAUSED
                state.paused_at_step = step_idx
                pause_event.clear()  # Block here

            # Wait for resume signal (blocks if paused)
            pause_event.wait()

            # Check if stopped while paused
            if state.status == WorkflowStatus.STOPPED:
                break

            state.status = WorkflowStatus.RUNNING
            state.paused_at_step = None
            # Track progress using file index
            state.current_file_index = step_idx

            # --- DEPENDENCY CHECK (continue mode) ---
            # If failure_mode is "continue" and upstream step failed,
            # check if this step depends on outputs from a failed step
            if state.config.failure_mode == "continue":
                blocked = self._check_blocked(file_config, state)
                if blocked:
                    step_result = StepResult(
                        step_index=step_idx,
                        file_path=file_config.file_path,
                        status=StepStatus.BLOCKED,
                        error=f"Blocked by upstream failure: missing data from {blocked}",
                        started_at=datetime.now().isoformat(),
                        completed_at=datetime.now().isoformat(),
                        iteration_id=self._get_iteration_context(state, combo_idx)["iteration_id"],
                        iteration_index=combo_idx,
                    )
                    state.step_results.append(step_result)
                    continue

            # --- EXECUTE STEP ---
            print(f"\n   [3.{step_idx+1}] STEP {step_idx+1}: {Path(file_config.file_path).name}")
            print(f"   {'Ã¢â€â‚¬'*70}")
            # Use combination values for this file step
            combination_inputs = combination[step_idx]
            print(f"   Ã¢â€ â€™ Inputs for this step: {combination_inputs}")

            step_result = self._execute_step_with_combination(
                step_idx, file_config, state, combination_inputs, combo_idx, total_combos
            )
            state.step_results.append(step_result)

            if step_result.status == StepStatus.COMPLETED:
                print(f"   Ã¢Å“â€œ Step completed successfully")
                self._track_completed_iteration_step(
                    state,
                    combo_idx,
                    step_idx,
                    file_config,
                    step_result.inputs if step_result.inputs else {},
                )
                mapping_metadata = self._build_step_mapping_metadata(file_config, state)
                self._record_manifest_entry(
                    state=state,
                    combo_idx=combo_idx,
                    step_idx=step_idx,
                    calc_step_index=step_idx,
                    file_config=file_config,
                    resolved_inputs=step_result.inputs if step_result.inputs else {},
                    outputs=step_result.outputs if step_result.outputs else {},
                    mapping_metadata=mapping_metadata,
                )
            else:
                print(f"   Ã¢Å“â€” Step failed: {step_result.error}")

            if step_result.status == StepStatus.COMPLETED:
                # Store both inputs and outputs in intermediate_results
                # This allows downstream mappings to reference input values that were set on this step
                combined_results = {}
                detail_inputs: Dict[str, Dict[str, Any]] = {}
                detail_outputs: Dict[str, Dict[str, Any]] = {}

                # First, add the input values that were set on this step
                # step_result.inputs is a dict of {alias: value} for all inputs that were set
                if hasattr(step_result, 'inputs') and step_result.inputs:
                    combined_results.update(step_result.inputs)
                    for alias, value in step_result.inputs.items():
                        detail_inputs[alias] = {
                            "value": value,
                            "units": (step_result.input_units or {}).get(alias),
                        }
                    print(f"[DEBUG] Stored inputs for {Path(file_config.file_path).name}: {list(step_result.inputs.keys())}")

                # Then, add the outputs (these may override inputs if same alias exists)
                if step_result.outputs:
                    # step_result.outputs may now be {alias: {"value": v, "units": u}} from workflow_get_outputs
                    for alias, output_entry in step_result.outputs.items():
                        if isinstance(output_entry, dict) and "value" in output_entry:
                            # New structured format with units
                            combined_results[alias] = output_entry["value"]
                            # Use user-defined units from WorkflowFile.output_units, not Mathcad computed units
                            detail_outputs[alias] = {
                                "value": output_entry["value"],
                                "units": file_config.output_units.get(alias),
                            }
                        else:
                            # Legacy flat format (scalar value only)
                            combined_results[alias] = output_entry
                            detail_outputs[alias] = {
                                "value": output_entry,
                                "units": file_config.output_units.get(alias),
                            }

                state.intermediate_results[file_config.file_path] = combined_results
                state.intermediate_details[file_config.file_path] = {
                    "inputs": detail_inputs,
                    "outputs": detail_outputs,
                }
                state.completed_files.append(file_config.file_path)
                print(f"[DEBUG] Stored results for {Path(file_config.file_path).name}: {list(combined_results.keys())}")
                print(f"[DEBUG]   combined_results: {combined_results}")

                # --- CONDITIONAL TERMINATION (Phase 7 feature - coexists with Phase 7.1) ---
                termination = self._check_conditions(state)
                if termination:
                    state.termination_message = termination.message or f"Condition met: {termination.expression}"
                    if termination.outcome == "success":
                        state.status = WorkflowStatus.COMPLETED
                    else:
                        state.status = WorkflowStatus.FAILED
                        state.error = state.termination_message
                    break

            elif step_result.status == StepStatus.FAILED:
                if state.config.failure_mode == "stop_on_error" or state.config.failure_mode == "retry":
                    state.status = WorkflowStatus.FAILED
                    state.error = step_result.error
                    # Auto-checkpoint on failure
                    cp = self.checkpoint_mgr.save_checkpoint(workflow_id, state)
                    state.checkpoint_path = cp
                    break
                elif state.config.failure_mode == "continue":
                    # Skip this step, continue to next
                    continue



        # Export results for this combination (only if still running - not stopped/failed)
        # Note: Status is NOT set to COMPLETED here - that happens in _execute_workflow after ALL combinations
        if state.status == WorkflowStatus.RUNNING:
            # --- EXPORT ALL STEPS for this combination ---
            print(f"\n[4] EXPORTING ALL RESULTS...")
            print(f"[DEBUG] Export for combination {combo_idx}/{total_combos}")
            for idx, file_config in enumerate(state.config.files):
                # Only export steps that actually executed (are in intermediate_results)
                if file_config.file_path not in state.intermediate_results:
                    print(f"   Ã¢â€ â€™ Skipping Step {idx+1}: {Path(file_config.file_path).name} (not executed)")
                    continue

                print(f"   Ã¢â€ â€™ Exporting Step {idx+1}: {Path(file_config.file_path).name}")
                # Export executed steps even when iteration terminated early due to a condition.
                resolved_inputs = {}
                manifest_key = (combo_idx, idx, file_config.file_path)
                manifest_idx = state._manifest_entry_index.get(manifest_key)
                if manifest_idx is not None:
                    resolved_inputs = state._run_manifest_entries[manifest_idx].get("inputs", {}) or {}
                self._export_step(state, file_config, idx, combo_idx, resolved_inputs)

    def _execute_step_with_combination(
        self, idx: int, file_config, state: WorkflowState,
        combination_inputs: Dict[str, Any], combo_idx: int, total_combos: int
    ) -> StepResult:
        """Execute a single workflow step with specific combination values"""
        started = datetime.now().isoformat()
        iteration_ctx = self._get_iteration_context(state, combo_idx, combination_inputs)
        step_dir = os.path.dirname(os.path.abspath(file_config.file_path))
        experimental_location = None
        if self._step_has_experimental_input(file_config):
            epoch_ms = self._get_experimental_epoch_ms(state, combo_idx)
            experimental_location = self.build_experimental_location(
                workflow_name=state.config.name,
                iteration_index=combo_idx,
                step_file_path=file_config.file_path,
                epoch_ms=epoch_ms,
                base_dir=step_dir,
            )
        try:
            # Build inputs from combination values + mappings
            print(f"      [a] Resolving inputs (combination + mappings)...")
            inputs = self._resolve_inputs_with_combination(
                file_config,
                combination_inputs,
                state.intermediate_results,
                state.config.mappings,
                state.intermediate_details,
                experimental_location=experimental_location,
            )
            print(f"         Ã¢â€ â€™ Resolved {len(inputs)} input(s)")

            # Resolve aggregation mappings
            agg_count = 0
            for agg in state.config.aggregation_mappings:
                if agg.target_file == file_config.file_path:
                    all_outputs = {}
                    for fp, outs in state.intermediate_results.items():
                        all_outputs.update(outs)
                    value = self.suggester.evaluate_aggregation(agg.expression, all_outputs)
                    inputs.append(InputConfig(alias=agg.target_alias, value=value, units=agg.units))
                    agg_count += 1
            if agg_count > 0:
                print(f"         Ã¢â€ â€™ Added {agg_count} aggregation input(s)")

            # Build units map for output retrieval
            # Determine what units downstream files expect for each output
            units_map = self._build_units_map_for_file(
                file_config.file_path,
                state.config.mappings,
                file_config.output_units
            )

            # Pre-execution validation: check worksheet accessibility and input discrepancies
            print(f"      [b] Running pre-execution validation...")
            validation = self._validate_step_worksheet(file_config, inputs)
            if validation["discrepancies"]:
                print(f"      [b] WARNING - Validation discrepancies:")
                for disc in validation["discrepancies"]:
                    print(f"         - {disc}")

            worksheet_inputs = set(validation.get("worksheet_inputs", []))
            expected_aliases = [inp.alias for inp in inputs if inp.alias]
            missing_expected_aliases = sorted(
                alias for alias in expected_aliases if alias not in worksheet_inputs
            )

            if missing_expected_aliases:
                mapped_target_aliases = {
                    m.target_alias
                    for m in state.config.mappings
                    if m.target_file == file_config.file_path
                }
                missing_direct_aliases = [
                    alias for alias in missing_expected_aliases if alias not in mapped_target_aliases
                ]

                if missing_direct_aliases:
                    return StepResult(
                        step_index=idx,
                        file_path=file_config.file_path,
                        status=StepStatus.FAILED,
                        error=(
                            "Pre-execution validation failed: missing designated inputs "
                            f"{missing_direct_aliases} on worksheet {Path(file_config.file_path).name}"
                        ),
                        started_at=started,
                        completed_at=datetime.now().isoformat(),
                        iteration_id=iteration_ctx["iteration_id"],
                        iteration_index=combo_idx,
                    )

                # Missing aliases are mapped-only. Treat as stale mappings and skip them.
                pruned_inputs = [inp for inp in inputs if inp.alias in worksheet_inputs]
                pruned_aliases = [inp.alias for inp in inputs if inp.alias not in worksheet_inputs]
                if pruned_aliases:
                    print(
                        "      [b] Pruning stale mapped inputs not present in worksheet: "
                        f"{pruned_aliases}"
                    )
                    validation["discrepancies"].append(
                        f"Skipped stale mapped inputs not present in worksheet: {pruned_aliases}"
                    )
                inputs = pruned_inputs

            # If worksheet is completely inaccessible, fail immediately without trying to execute
            if not validation["is_valid"] and not validation.get("reconnect_succeeded", False):
                error_msg = "; ".join(validation["discrepancies"]) if validation["discrepancies"] else "Worksheet validation failed"
                return StepResult(
                    step_index=idx,
                    file_path=file_config.file_path,
                    status=StepStatus.FAILED,
                    error=f"Pre-execution validation failed: {error_msg}",
                    started_at=started,
                    completed_at=datetime.now().isoformat(),
                    iteration_id=iteration_ctx["iteration_id"],
                    iteration_index=combo_idx,
                )

            # Execute with optional retry (validation info passed to avoid re-validation)
            print(f"      [c] Executing Mathcad file...")
            print(f"         Ã¢â€ â€™ Opening worksheet & setting inputs: {Path(file_config.file_path).name}")
            result = self._execute_file_with_retry(
                file_config, inputs, state.config.retry_config, units_map
            )

            if result and result.status == "success":
                outputs = result.data.get("outputs", {}) if isinstance(result.data, dict) else result.data
                print(f"         Ã¢Å“â€œ Execution successful")
                print(f"         Ã¢â€ â€™ Retrieved {len(outputs) if isinstance(outputs, dict) else 0} output(s)")

                # Convert inputs list to dict for storage
                inputs_dict = {}
                input_units = {}
                for inp in inputs:
                    key = self._make_input_key(inp, file_config, state.config)
                    inputs_dict[key] = inp.value
                    input_units[key] = inp.units

                # Include validation discrepancies in outputs if any (for user notification)
                if validation["discrepancies"]:
                    outputs = dict(outputs)  # Copy to avoid modifying original
                    outputs["_validation_discrepancies"] = validation["discrepancies"]
                    outputs["_worksheet_inputs"] = validation.get("worksheet_inputs", [])

                csv_tables = []
                csv_error = None
                if experimental_location:
                    csv_tables, csv_error = self._poll_experimental_csv_tables(step_dir, experimental_location)

                return StepResult(
                    step_index=idx,
                    file_path=file_config.file_path,
                    status=StepStatus.COMPLETED,
                    outputs=outputs,
                    inputs=inputs_dict,  # Store the inputs that were set
                    input_units=input_units,
                    started_at=started,
                    completed_at=datetime.now().isoformat(),
                    iteration_id=iteration_ctx["iteration_id"],
                    iteration_index=combo_idx,
                    csv_tables=csv_tables,
                    csv_error=csv_error,
                )
            else:
                return StepResult(
                    step_index=idx,
                    file_path=file_config.file_path,
                    status=StepStatus.FAILED,
                    error=result.error_message if result else "Job timeout",
                    started_at=started,
                    completed_at=datetime.now().isoformat(),
                    iteration_id=iteration_ctx["iteration_id"],
                    iteration_index=combo_idx,
                )
        except Exception as e:
            return StepResult(
                step_index=idx,
                file_path=file_config.file_path,
                status=StepStatus.FAILED,
                error=str(e),
                error_detail=traceback.format_exc(),
                started_at=started,
                completed_at=datetime.now().isoformat(),
                iteration_id=iteration_ctx["iteration_id"],
                iteration_index=combo_idx,
            )

    def _build_units_map_for_file(self, source_file_path: str, mappings: List[FileMapping],
                                   output_units: Dict[str, str] = None) -> Dict[str, str]:
        """
        Build a map of output aliases to expected units for a given source file.

        Priority:
        1. Start with output_units from file config
        2. Override with mapping.units (higher priority)
        """
        units_map = dict(output_units or {})

        for mapping in mappings:
            if mapping.source_file == source_file_path and mapping.units:
                units_map[mapping.source_alias] = mapping.units

        return units_map

    def _validate_step_worksheet(self, file_config, inputs) -> Dict[str, Any]:
        """
        Validate that a worksheet is accessible and has the expected inputs before execution.

        This performs pre-execution validation:
        1. Checks that the worksheet COM reference is still valid
        2. Verifies that expected inputs exist as designated inputs in the worksheet
        3. Reports any discrepancies (missing or extra inputs)

        Returns dict with:
          - is_valid: bool
          - worksheet_inputs: list of designated input aliases
          - expected_inputs: list of input aliases the workflow expects to set
          - discrepancies: list of discrepancy messages (if any)
          - reconnect_attempted: bool
          - reconnect_succeeded: bool

        The caller should check discrepancies and may choose to notify the user
        before proceeding with execution.
        """
        expected_aliases = [inp.alias for inp in inputs if inp.alias]

        print(f"      [validate] Checking worksheet: {Path(file_config.file_path).name}")
        print(f"      [validate] Expected inputs: {expected_aliases}")

        # Submit validation job to engine
        job_id = self.engine.submit_job("workflow_validate", {
            "path": file_config.file_path,
            "expected_inputs": expected_aliases,
            "warn_on_extra_inputs": False,
        })
        result = self._poll_result(job_id)

        if not result or result.status != "success":
            error_msg = result.error_message if result else "Validation job failed"
            print(f"      [validate] FAILED: {error_msg}")
            return {
                "is_valid": False,
                "worksheet_inputs": [],
                "expected_inputs": expected_aliases,
                "discrepancies": [f"Validation failed: {error_msg}"],
                "reconnect_attempted": False,
                "reconnect_succeeded": False
            }

        data = result.data
        is_valid = data.get("is_valid", False)
        worksheet_inputs = data.get("inputs", [])
        discrepancies = data.get("input_discrepancies", [])
        needs_reconnect = data.get("needs_reconnect", False)
        reconnect_failed = data.get("reconnect_failed", False)
        error = data.get("error")

        # Build discrepancy messages
        if not is_valid:
            if error:
                discrepancies.append(f"Worksheet error: {error}")
            if needs_reconnect and reconnect_failed:
                discrepancies.append("Auto-reconnect failed: worksheet COM reference is stale")

        print(f"      [validate] Worksheet inputs: {worksheet_inputs}")
        print(f"      [validate] Is valid: {is_valid}")
        if discrepancies:
            print(f"      [validate] Discrepancies found: {discrepancies}")

        return {
            "is_valid": is_valid,
            "worksheet_inputs": worksheet_inputs,
            "expected_inputs": expected_aliases,
            "discrepancies": discrepancies,
            "reconnect_attempted": needs_reconnect,
            "reconnect_succeeded": needs_reconnect and not reconnect_failed
        }

    def _execute_file_with_retry(self, file_config, inputs, retry_config, units_map: Optional[Dict[str, str]] = None):
        """Execute file with optional retry using tenacity.

        Uses workflow_step command which:
        1. Opens the file (maintains worksheet reference)
        2. Sets inputs
        3. Activates worksheet (triggers recalculation)
        4. Gets outputs (with units conversion if specified)

        All worksheets remain open during workflow execution.

        Args:
            file_config: File configuration
            inputs: List of InputConfig objects
            retry_config: Retry configuration
            units_map: Optional dict of {output_alias: units} for unit conversion
        """
        # Convert InputConfig list to dict format that engine expects
        inputs_as_dicts = [
            {"alias": inp.alias, "value": inp.value, "units": inp.units}
            for inp in inputs
        ]
        print(f"[DEBUG] _execute_file_with_retry: inputs_as_dicts = {inputs_as_dicts}")

        # If no retry config or max_retries is 0, execute directly
        if retry_config is None or retry_config.max_retries == 0:
            print(f"         Ã¢â€ â€™ Submitting job to engine...")
            job_id = self.engine.submit_job("workflow_step", {
                "path": file_config.file_path,
                "inputs": inputs_as_dicts,
                "units_map": units_map or {}
            })
            print(f"         Ã¢â€ â€™ Waiting for job completion (job_id: {job_id})...")
            return self._poll_result(job_id)

        # Use tenacity for retry
        @retry(
            stop=stop_after_attempt(retry_config.max_retries + 1),  # +1 because first attempt isn't a "retry"
            wait=wait_exponential(multiplier=retry_config.multiplier, min=retry_config.min_wait, max=retry_config.max_wait),
            retry=retry_if_exception_type(Exception),
            reraise=True
        )
        def _attempt():
            job_id = self.engine.submit_job("workflow_step", {
                "path": file_config.file_path,
                "inputs": inputs_as_dicts,
                "units_map": units_map or {}
            })
            result = self._poll_result(job_id)
            if result and result.status == "success":
                return result
            raise Exception(result.error_message if result else "Job timeout")

        return _attempt()

    def _check_conditions(self, state: WorkflowState) -> Optional[ConditionalTermination]:
        """Check if any conditional termination criteria are met"""
        # Collect all outputs from intermediate_results into a flat dict
        all_outputs = {}
        for file_outputs in state.intermediate_results.values():
            all_outputs.update(file_outputs)

        # Check each condition
        for condition in state.config.conditions:
            # Evaluate after specified step or after every step if -1
            if condition.after_step == -1 or condition.after_step == state.current_file_index:
                try:
                    if self.suggester.evaluate_condition(condition.expression, all_outputs):
                        return condition
                except Exception as e:
                    # Log warning but don't fail workflow on condition evaluation error
                    print(f"Warning: Failed to evaluate condition '{condition.expression}': {e}")
                    continue

        return None

    def _check_blocked(self, file_config, state: WorkflowState) -> Optional[str]:
        """Check if this step is blocked by upstream failure"""
        # Get mappings targeting this file
        relevant_mappings = [m for m in state.config.mappings if m.target_file == file_config.file_path]

        for mapping in relevant_mappings:
            # Check if source file has a FAILED or BLOCKED step_result
            for step_result in state.step_results:
                if step_result.file_path == mapping.source_file:
                    if step_result.status in (StepStatus.FAILED, StepStatus.BLOCKED):
                        return mapping.source_file

        return None

    def _export_step(self, state: WorkflowState, file_config, idx: int,
                     combo_idx: int = 1, combination_inputs: Dict[str, Any] = None):
        """Export step results as PDF/MCDX if requested

        Args:
            state: Current workflow state
            file_config: Configuration for the file being exported
            idx: Step index in workflow
            combo_idx: Current combination iteration number (1-indexed)
            combination_inputs: Dict of resolved input parameters actually applied to this step
        """
        policy = self._resolve_effective_export_policy(state, file_config)
        if not (policy["pdf"] or policy["mcdx"]):
            print(f"         Ã¢â€ â€™ No export configured, skipping")
            return

        print(f"      [c] Exporting files...")
        run_root_dir = self._resolve_run_root(state)
        iteration_ctx = self._get_iteration_context(state, combo_idx, combination_inputs)
        export_dir = iteration_ctx["iteration_dir"]

        base_name = os.path.splitext(os.path.basename(file_config.file_path))[0]
        # Look up resolved_inputs from manifest (keyed by combo_idx, not flat search)
        # This ensures we get THIS combo's inputs, not the first match from another combo
        manifest_key = (combo_idx, idx, file_config.file_path)
        manifest_idx = getattr(state, "_manifest_entry_index", {}).get(manifest_key)
        resolved_inputs = None
        if manifest_idx is not None:
            manifest_entry = getattr(state, "_run_manifest_entries", [])[manifest_idx]
            resolved_inputs = manifest_entry.get("inputs") or None
        filename_base = self._build_export_filename_base(file_config, idx, combo_idx, combination_inputs, resolved_inputs=resolved_inputs)
        run_id = getattr(state, "_run_id", "run")
        iteration_id = iteration_ctx["iteration_id"]
        generated = {"pdf": None, "mcdx": None}
        if policy["pdf"]:
            export_key = (run_id, iteration_id, combo_idx, idx, "pdf")
            if export_key in state._exported_keys:
                print("         Ã¢â€ â€™ PDF already exported for this step/iteration, skipping duplicate")
            else:
                save_path = os.path.abspath(os.path.join(export_dir, f"{filename_base}.pdf"))
                print(f"         Ã¢â€ â€™ Exporting PDF: {filename_base}.pdf")
                save_job_id = self.engine.submit_job("workflow_save_as", {
                    "worksheet_path": file_config.file_path,
                    "path": save_path
                })
                save_result = self._poll_result(save_job_id)
                if not save_result:
                    print("            WARNING: PDF export timed out waiting for workflow_save_as result")
                elif getattr(save_result, "status", None) != "success":
                    print(
                        "            WARNING: PDF export failed: "
                        f"{getattr(save_result, 'error_message', 'unknown error')}"
                    )
                elif not os.path.exists(save_path):
                    print(f"            WARNING: PDF export reported success but file missing at {save_path}")
                else:
                    generated["pdf"] = save_path
                    state._exported_keys.add(export_key)
                    print(f"            Ã¢Å“â€œ PDF exported")

        if policy["mcdx"]:
            export_key = (run_id, iteration_id, combo_idx, idx, "mcdx")
            if export_key in state._exported_keys:
                print("         Ã¢â€ â€™ MCDX already exported for this step/iteration, skipping duplicate")
            else:
                save_path = os.path.abspath(os.path.join(export_dir, f"{filename_base}.mcdx"))
                print(f"         Ã¢â€ â€™ Exporting MCDX: {filename_base}.mcdx")
                save_job_id = self.engine.submit_job("workflow_save_as", {
                    "worksheet_path": file_config.file_path,
                    "path": save_path
                })
                save_result = self._poll_result(save_job_id)
                if not save_result:
                    print("            WARNING: MCDX export timed out waiting for workflow_save_as result")
                elif getattr(save_result, "status", None) != "success":
                    print(
                        "            WARNING: MCDX export failed: "
                        f"{getattr(save_result, 'error_message', 'unknown error')}"
                    )
                elif not os.path.exists(save_path):
                    print(f"            WARNING: MCDX export reported success but file missing at {save_path}")
                else:
                    generated["mcdx"] = save_path
                    state._exported_keys.add(export_key)
                    print(f"            Ã¢Å“â€œ MCDX exported")

        if not generated["pdf"] and not generated["mcdx"]:
            return

        # Track export info for table of contents / run manifest
        if not hasattr(state, 'export_manifest'):
            state.export_manifest = []

        state.export_manifest.append({
            'run_id': run_id,
            'combo_idx': combo_idx,
            'run_root_dir': run_root_dir,
            'iteration_id': iteration_ctx['iteration_id'],
            'iteration_dir': iteration_ctx['iteration_dir'],
            'step_idx': idx,
            'file_path': file_config.file_path,
            'file_name': base_name,
            'parameters': combination_inputs or {},
            'export_dir': export_dir,
            'filename_base': filename_base,
            'pdf_path': generated["pdf"],
            'mcdx_path': generated["mcdx"],
        })
        self._update_manifest_entry_exports(
            state=state,
            combo_idx=combo_idx,
            step_idx=idx,
            pdf_path=generated["pdf"],
            mcdx_path=generated["mcdx"],
            file_path=file_config.file_path,
        )

    def _track_completed_iteration_step(
        self,
        state: WorkflowState,
        combo_idx: int,
        step_index: int,
        file_config,
        resolved_inputs: Dict[str, Any],
    ):
        """Record calculation steps that completed in this iteration."""
        if not hasattr(state, "_iteration_completed_steps"):
            state._iteration_completed_steps = {}
        state._iteration_completed_steps.setdefault(combo_idx, []).append({
            "step_index": step_index,
            "file_config": file_config,
            "resolved_inputs": resolved_inputs or {},
        })

    def _build_step_mapping_metadata(self, file_config, state: WorkflowState) -> List[Dict[str, Any]]:
        """Capture mapping metadata and resolved values for current calculation step."""
        metadata: List[Dict[str, Any]] = []
        relevant_mappings = [m for m in state.config.mappings if m.target_file == file_config.file_path]
        mapping_by_target = {(m.target_file, m.target_alias): m for m in state.config.mappings}

        def resolve_mapping_chain(mapping: FileMapping) -> FileMapping:
            """Follow input-to-input mappings to their original upstream source."""
            visited = set()
            current = mapping

            while current:
                source_type = current.source_type if getattr(current, "source_type", None) else "output"
                if source_type != "input":
                    return current

                key = (current.source_file, current.source_alias)
                if key in visited:
                    return current
                visited.add(key)

                upstream = mapping_by_target.get(key)
                if not upstream:
                    return current
                current = upstream

            return mapping

        for mapping in relevant_mappings:
            resolved_mapping = resolve_mapping_chain(mapping)
            source_type = resolved_mapping.source_type if getattr(resolved_mapping, "source_type", None) else "output"
            source_bucket = "inputs" if source_type == "input" else "outputs"
            source_details = (
                state.intermediate_details
                .get(resolved_mapping.source_file, {})
                .get(source_bucket, {})
                .get(resolved_mapping.source_alias)
            )
            source_outputs = state.intermediate_results.get(resolved_mapping.source_file, {})
            resolved_value = source_details["value"] if source_details else source_outputs.get(resolved_mapping.source_alias)
            resolved_units = mapping.units or (source_details.get("units") if source_details else None)
            metadata.append({
                "source_file": resolved_mapping.source_file,
                "source_alias": resolved_mapping.source_alias,
                "source_type": source_type,
                "target_alias": mapping.target_alias,
                "units": mapping.units,
                "resolved_units": resolved_units,
                "resolved_value": resolved_value,
            })
        return metadata

    def _record_manifest_entry(
        self,
        state: WorkflowState,
        combo_idx: int,
        step_idx: int,
        calc_step_index: int,
        file_config,
        resolved_inputs: Dict[str, Any],
        outputs: Dict[str, Any],
        mapping_metadata: List[Dict[str, Any]],
    ):
        """Create or update canonical run manifest entry for a completed calculation step."""
        run_root = self._resolve_run_root(state)
        iteration_ctx = self._get_iteration_context(state, combo_idx)
        key = (combo_idx, calc_step_index, file_config.file_path)

        entry = {
            "run_id": getattr(state, "_run_id", ""),
            "iteration_index": combo_idx,
            "iteration_id": iteration_ctx["iteration_id"],
            "step_index": step_idx,
            "calc_step_index": calc_step_index,
            "step_name": Path(file_config.file_path).stem,
            "step_dir": os.path.relpath(iteration_ctx["iteration_dir"], run_root).replace("\\", "/"),
            "file_path": file_config.file_path,
            "step_type": "calculation",
            "inputs": resolved_inputs or {},
            "outputs": outputs or {},
            "mapping_metadata": mapping_metadata,
            "pdf": None,
            "mcdx": None,
        }

        manifest_index = getattr(state, "_manifest_entry_index", {})
        existing_idx = manifest_index.get(key)
        if existing_idx is None:
            state._run_manifest_entries.append(entry)
            manifest_index[key] = len(state._run_manifest_entries) - 1
            state._manifest_entry_index = manifest_index
        else:
            state._run_manifest_entries[existing_idx].update(entry)

    def _update_manifest_entry_exports(
        self,
        state: WorkflowState,
        combo_idx: int,
        step_idx: int,
        pdf_path: Optional[str],
        mcdx_path: Optional[str],
        file_path: Optional[str] = None,
    ):
        """Attach export links to manifest entry for this step/iteration."""
        run_root = self._resolve_run_root(state)
        target_entry = None
        if file_path is not None:
            manifest_index = getattr(state, "_manifest_entry_index", {})
            indexed_idx = manifest_index.get((combo_idx, step_idx, file_path))
            if indexed_idx is not None and 0 <= indexed_idx < len(state._run_manifest_entries):
                target_entry = state._run_manifest_entries[indexed_idx]

        # Backward-compatible fallback if index key doesn't exist for this record.
        if target_entry is None:
            for entry in state._run_manifest_entries:
                entry_calc_index = entry.get("calc_step_index")
                step_matches = (
                    entry_calc_index == step_idx
                    if entry_calc_index is not None
                    else entry.get("step_index") == step_idx
                )
                if (
                    entry["iteration_index"] == combo_idx
                    and step_matches
                    and (file_path is None or entry.get("file_path") == file_path)
                ):
                    target_entry = entry
                    break

        if target_entry is not None:
            if pdf_path:
                target_entry["pdf"] = os.path.relpath(pdf_path, run_root).replace("\\", "/")
            if mcdx_path:
                target_entry["mcdx"] = os.path.relpath(mcdx_path, run_root).replace("\\", "/")

    def _write_step_parameters_snapshot(
        self,
        state: WorkflowState,
        combo_idx: int,
        step_idx: int,
        file_config,
        resolved_inputs: Dict[str, Any],
        mapping_metadata: List[Dict[str, Any]],
    ):
        """Compatibility no-op: per-step parameter snapshot files were removed to reduce clutter."""
        return None

    def _write_run_manifest(self, state: WorkflowState) -> str:
        """Persist canonical run_manifest.json at run root."""
        run_root = self._resolve_run_root(state)
        manifest_path = os.path.join(run_root, "run_manifest.json")
        payload = {
            "run_id": getattr(state, "_run_id", ""),
            "workflow_name": state.config.name,
            "generated_at": datetime.now().isoformat(),
            "entries": sorted(
                state._run_manifest_entries,
                key=lambda e: (e["iteration_index"], e["step_index"], e["step_name"]),
            ),
        }
        with open(manifest_path, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2)
        return manifest_path

    def _generate_table_of_contents(self, state: WorkflowState):
        """Generate run-level index from in-memory manifest entries only."""
        run_root = self._resolve_run_root(state)
        entries = sorted(
            state._run_manifest_entries,
            key=lambda e: (e["iteration_index"], e["step_index"], e["step_name"]),
        )
        input_keys = sorted({k for e in entries for k in (e.get("inputs", {}) or {}).keys()})
        output_keys = sorted({k for e in entries for k in (e.get("outputs", {}) or {}).keys()})
        input_headers = "".join([f"<th>Input: {html.escape(str(k))}</th>" for k in input_keys])
        output_headers = "".join([f"<th>Output: {html.escape(str(k))}</th>" for k in output_keys])
        table_rows = []

        for entry in entries:
            pdf_rel = entry.get("pdf")
            mcdx_rel = entry.get("mcdx")
            pdf_cell = f"<a href=\"{pdf_rel}\">PDF</a>" if pdf_rel else "-"
            mcdx_cell = f"<a href=\"{mcdx_rel}\">MCDX</a>" if mcdx_rel else "-"
            input_cells = []
            for key in input_keys:
                value = (entry.get("inputs", {}) or {}).get(key, "")
                input_cells.append(
                    f"<td data-sort-value=\"{html.escape(str(value))}\">{html.escape(str(value))}</td>"
                )
            output_cells = []
            for key in output_keys:
                value = (entry.get("outputs", {}) or {}).get(key, "")
                output_cells.append(
                    f"<td data-sort-value=\"{html.escape(str(value))}\">{html.escape(str(value))}</td>"
                )
            row_lines = [
                "      <tr>",
                f"        <td data-sort-value=\"{html.escape(str(entry['iteration_id']))}\">{html.escape(str(entry['iteration_id']))}</td>",
                f"        <td data-sort-value=\"{entry['step_index'] + 1:02d}\">{entry['step_index'] + 1:02d} - {html.escape(str(entry['step_name']))}</td>",
                f"        <td data-sort-value=\"{html.escape(str(entry.get('step_type', 'calculation')))}\">{html.escape(str(entry.get('step_type', 'calculation')))}</td>",
                f"        {''.join(input_cells)}",
                f"        {''.join(output_cells)}",
                f"        <td>{pdf_cell}</td>",
                f"        <td>{mcdx_cell}</td>",
                "      </tr>",
            ]
            table_rows.append("\n".join(row_lines))

        table_header = f"<tr><th>Iteration</th><th>Step</th><th>Step Type</th>{input_headers}{output_headers}<th>PDF</th><th>MCDX</th></tr>"
        template_path = Path(__file__).resolve().parent.parent / "templates" / "run_index_ui.html"
        template = template_path.read_text(encoding="utf-8")
        html_output = (
            template
            .replace("{{TITLE}}", f"{state.config.name} - Run Index")
            .replace("{{WORKFLOW_NAME}}", str(state.config.name))
            .replace("{{RUN_ID}}", str(getattr(state, "_run_id", "")))
            .replace("{{TABLE_HEADER}}", table_header)
            .replace("{{TABLE_ROWS}}", "\n".join(table_rows))
        )
        toc_path = os.path.join(run_root, "index.html")
        with open(toc_path, "w", encoding="utf-8") as handle:
            handle.write(html_output)
        print(f"   Ã¢Å“â€œ Table of contents generated: {toc_path}")

    def _resolve_inputs_with_combination(
        self, file_config, combination_inputs: Dict[str, Any],
        intermediate_results, mappings, intermediate_details: Optional[Dict[str, Dict[str, Dict[str, Dict[str, Any]]]]] = None,
        experimental_location: Optional[str] = None,
    ) -> List[InputConfig]:
        """Build InputConfigs from combination values and mapped outputs"""
        inputs = []
        details = intermediate_details or {}
        experimental_alias = self.EXPERIMENTAL_INPUT_ALIAS

        mapping_by_target = {
            (m.target_file, m.target_alias): m
            for m in mappings
            if m.target_alias != experimental_alias
        }

        def resolve_mapping_chain(mapping: FileMapping) -> FileMapping:
            """Follow input-to-input mappings to their original upstream source."""
            visited = set()
            current = mapping

            while current:
                source_type = current.source_type if getattr(current, "source_type", None) else "output"
                if source_type != "input":
                    return current

                key = (current.source_file, current.source_alias)
                if key in visited:
                    return current
                visited.add(key)

                upstream = mapping_by_target.get(key)
                if not upstream:
                    return current
                current = upstream

            return mapping

        print(f"      [DEBUG] _resolve_inputs_with_combination for: {Path(file_config.file_path).name}")
        print(f"      [DEBUG]   combination_inputs: {combination_inputs}")
        print(f"      [DEBUG]   intermediate_results keys: {list(intermediate_results.keys())}")

        # D-03, D-12: Build set of aliases that have mappings - mapping takes precedence
        mapped_aliases = {
            m.target_alias
            for m in mappings
            if m.target_file == file_config.file_path and m.target_alias != experimental_alias
        }
        print(f"      [DEBUG]   mapped_aliases: {mapped_aliases}")

        if self._step_has_experimental_input(file_config) and experimental_location:
            original_input = next((inp for inp in file_config.inputs if inp.alias == experimental_alias), None)
            units = original_input.units if original_input else None
            inputs.append(InputConfig(
                alias=experimental_alias,
                value=experimental_location,
                units=units,
            ))
            print(f"      [DEBUG]   Added experimental input: {experimental_alias}={experimental_location}")

        # Add inputs from this combination (using specific values, not arrays)
        for alias, value in combination_inputs.items():
            if alias == experimental_alias:
                print(f"      [DEBUG]   Skipping direct input {alias} - experimental input managed by system")
                continue
            # D-03: Skip aliases that have mappings - mapping takes precedence
            if alias in mapped_aliases:
                print(f"      [DEBUG]   Skipping direct input {alias} - has upstream mapping")
                continue

            # Find the original input config to get units
            original_input = next((inp for inp in file_config.inputs if inp.alias == alias), None)
            units = original_input.units if original_input else None

            inputs.append(InputConfig(
                alias=alias,
                value=value,  # Single value from combination
                units=units
            ))
            print(f"      [DEBUG]   Added direct input: {alias}={value}")

        # Add mapped outputs from upstream files
        relevant_mappings = [
            m for m in mappings
            if m.target_file == file_config.file_path and m.target_alias != experimental_alias
        ]
        print(f"      [DEBUG]   relevant_mappings count: {len(relevant_mappings)}")
        for mapping in relevant_mappings:
            resolved_mapping = resolve_mapping_chain(mapping)
            source_type = resolved_mapping.source_type if getattr(resolved_mapping, "source_type", None) else "output"
            source_bucket = "inputs" if source_type == "input" else "outputs"
            source_data = intermediate_results.get(resolved_mapping.source_file, {})
            source_detail = (
                details
                .get(resolved_mapping.source_file, {})
                .get(source_bucket, {})
                .get(resolved_mapping.source_alias)
            )
            print(f"      [DEBUG]   Checking mapping: {mapping.source_alias} -> {mapping.target_alias}")
            print(f"      [DEBUG]     source_data keys: {list(source_data.keys())}")
            if source_detail or resolved_mapping.source_alias in source_data:
                # The value is already in the correct units (retrieved with units_map)
                # Pass units to set_real_input so it knows what units the value represents
                if source_detail:
                    value = source_detail.get("value")
                    inherited_units = source_detail.get("units")
                else:
                    value = source_data[resolved_mapping.source_alias]
                    inherited_units = None
                effective_units = mapping.units if mapping.units else inherited_units
                inputs.append(InputConfig(
                    alias=mapping.target_alias,
                    value=value,
                    units=effective_units if effective_units else None,
                    source=resolved_mapping.source_file,  # Track upstream source
                ))
                print(f"      [DEBUG]   Added mapped input: {mapping.target_alias}={value}")
            else:
                print(f"      [DEBUG]   WARNING: source_alias '{resolved_mapping.source_alias}' not found in source_data!")

        return inputs

    def _poll_result(self, job_id: str, timeout: float = 600.0) -> Optional[Any]:
        """Wait for job completion via EngineManager blocking wait."""
        return self.engine.wait_for_result(job_id, timeout=timeout)

    def _build_created_files_payload(self, state: WorkflowState) -> List[Dict[str, Any]]:
        """Flatten export manifest into UI-friendly created-file records."""
        created_files: List[Dict[str, Any]] = []
        for entry in getattr(state, "export_manifest", []) or []:
            step_name = Path(entry.get("file_path", "")).stem or entry.get("file_name") or "Step"
            for export_format, key in (("pdf", "pdf_path"), ("mcdx", "mcdx_path")):
                export_path = entry.get(key)
                if not export_path:
                    continue
                created_files.append({
                    "path": export_path,
                    "name": Path(export_path).name,
                    "format": export_format,
                    "step_index": int(entry.get("step_idx", 0)),
                    "step_name": step_name,
                    "iteration_id": entry.get("iteration_id"),
                })
        return created_files

    def _build_result_summary(self, state: WorkflowState, created_files: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Derive run-level summary fields for workflow result UI."""
        completed_steps = sum(1 for result in state.step_results if result.status == StepStatus.COMPLETED)
        running_step = next((result for result in state.step_results if result.status == StepStatus.RUNNING), None)
        last_completed = next(
            (result for result in reversed(state.step_results) if result.status == StepStatus.COMPLETED),
            None,
        )
        total_iterations = state.total_iterations or 0
        completed_iterations = state.completed_iterations or 0
        if total_iterations <= 0:
            total_iterations = 1
        if completed_iterations < 0:
            completed_iterations = 0

        current_step_label = None
        if running_step:
            current_step_label = Path(running_step.file_path).name
        elif 0 <= state.current_file_index < len(state.config.files):
            current_step_label = Path(state.config.files[state.current_file_index].file_path).name

        last_completed_step_label = Path(last_completed.file_path).name if last_completed else None
        pdf_count = sum(1 for item in created_files if item["format"] == "pdf")
        mcdx_count = sum(1 for item in created_files if item["format"] == "mcdx")

        return {
            "completed_steps": completed_steps,
            "total_steps": len(state.config.files),
            "completed_iterations": completed_iterations,
            "total_iterations": total_iterations,
            "created_file_count": len(created_files),
            "pdf_count": pdf_count,
            "mcdx_count": mcdx_count,
            "current_step_label": current_step_label,
            "last_completed_step_label": last_completed_step_label,
        }

    def get_status(self, workflow_id: str) -> Optional[Dict[str, Any]]:
        """Get current workflow status with enhanced step results"""
        state = self.workflows.get(workflow_id)
        if not state:
            return None

        total_files = len(state.config.files)
        if total_files > 0:
            safe_current_index = max(0, min(state.current_file_index, total_files - 1))
            completed_count = min(len(state.completed_files), total_files)
            total_iterations = state.total_iterations or 0
            completed_iterations = state.completed_iterations or 0
            current_iteration = state.current_iteration or 0
            if total_iterations > 1:
                total_steps = total_iterations * total_files
                if state.status in (WorkflowStatus.COMPLETED, WorkflowStatus.STOPPED):
                    progress_calc = int((completed_iterations / total_iterations) * 100) if total_iterations else 0
                else:
                    completed_steps = completed_iterations * total_files
                    if current_iteration > completed_iterations:
                        completed_steps += len(
                            getattr(state, "_iteration_completed_steps", {}).get(current_iteration, [])
                        )
                    progress_calc = int((completed_steps / total_steps) * 100) if total_steps else 0
            else:
                if state.status in (WorkflowStatus.COMPLETED, WorkflowStatus.STOPPED):
                    progress_calc = int((completed_count / total_files) * 100)
                else:
                    progress_calc = int((min(safe_current_index, total_files) / total_files) * 100)
        else:
            safe_current_index = 0
            progress_calc = 0

        created_files = self._build_created_files_payload(state)
        result_summary = self._build_result_summary(state, created_files)

        return {
            "workflow_id": state.workflow_id,
            "status": state.status.value,
            "current_file_index": safe_current_index,
            "total_files": total_files,
            "completed_files": state.completed_files,
            "progress": progress_calc,
            "error": state.error,
            "step_results": [
                {
                    "step_index": sr.step_index,
                    "file_path": sr.file_path,
                    "status": sr.status.value,
                    "error": sr.error,
                    "error_detail": sr.error_detail,
                    "retry_count": sr.retry_count,
                    "started_at": sr.started_at,
                    "completed_at": sr.completed_at,
                    "outputs": sr.outputs,
                    "inputs": sr.inputs,
                    "input_units": sr.input_units,
                    "iteration_id": sr.iteration_id,
                    "iteration_index": sr.iteration_index,
                    "csv_tables": [asdict(table) for table in sr.csv_tables],
                    "csv_error": sr.csv_error,
                }
                for sr in state.step_results
            ],
            "paused_at_step": state.paused_at_step,
            "termination_message": state.termination_message,
            "checkpoint_path": state.checkpoint_path,
            "pause_mode": state.config.pause_mode,
            "failure_mode": state.config.failure_mode,
            "created_files": created_files,
            "result_summary": result_summary,
        }

    def pause_workflow(self, workflow_id: str):
        """Pause workflow execution (takes effect after current step completes)"""
        state = self.workflows.get(workflow_id)
        if state:
            if workflow_id in self.pause_events:
                self.pause_events[workflow_id].clear()
            state.status = WorkflowStatus.PAUSED
            state.paused_at_step = state.current_file_index

    def resume_workflow(self, workflow_id: str):
        """Resume paused workflow execution"""
        if workflow_id in self.pause_events:
            self.pause_events[workflow_id].set()

    def stop_workflow(self, workflow_id: str):
        """Stop a running workflow"""
        state = self.workflows.get(workflow_id)
        if state:
            state.status = WorkflowStatus.STOPPED
            # Also set the pause event to unblock if paused
            if workflow_id in self.pause_events:
                self.pause_events[workflow_id].set()

    def _record_finished_workflow(self, workflow_id: str) -> None:
        """Track finished workflows and evict older ones to bound memory growth."""
        state = self.workflows.get(workflow_id)
        if not state or state.status not in {
            WorkflowStatus.COMPLETED,
            WorkflowStatus.FAILED,
            WorkflowStatus.STOPPED,
        }:
            return

        if workflow_id in self._finished_workflow_ids:
            self._finished_workflow_ids.remove(workflow_id)
        self._finished_workflow_ids.append(workflow_id)

        while len(self._finished_workflow_ids) > self.MAX_RETAINED_FINISHED_WORKFLOWS:
            evict_id = self._finished_workflow_ids.pop(0)
            self.workflows.pop(evict_id, None)
            self.pause_events.pop(evict_id, None)

    def _clear_workflow_worksheets(self):
        """Clear workflow worksheet references in the worker"""
        try:
            job_id = self.engine.submit_job("workflow_clear", {})
            self._poll_result(job_id, timeout=5.0)
        except Exception as e:
            print(f"Warning: Failed to clear workflow worksheets: {e}")
