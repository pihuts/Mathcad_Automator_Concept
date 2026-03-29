from MathcadPy import Mathcad
from pathlib import Path
from typing import List, Dict, Any, Optional
import time
import re
from .error_translator import translate_error
from .utils import extract_input_config
# NOTE: func_timeout CANNOT be used with COM objects. COM uses STA (Single-Threaded Apartment)
# threading model - objects are bound to the thread that created them. func_timeout runs code
# in a NEW thread, causing AttributeError on all COM method calls.

class MathcadWorker:
    def __init__(self):
        self.mc: Optional[Mathcad] = None  # Mathcad() instance
        self.worksheet: Any = None  # Worksheet() instance (current active worksheet for single-file operations)
        self.current_file_path: Optional[str] = None  # Track currently open file to avoid unnecessary reopening
        # Workflow-specific: maintain multiple open worksheets
        self.workflow_worksheets: Dict[str, Any] = {}  # path -> worksheet object mapping
        # COM initialization is handled internally by MathcadPy

    @staticmethod
    def _normalize_worksheet_identity(name: str) -> str:
        """Normalize worksheet names to support robust same-sheet matching after Save As."""
        stem = Path(name).stem.lower()
        stem = re.sub(r"^\d+\.", "", stem)
        return re.sub(r"[^a-z0-9]+", "", stem)

    def _find_equivalent_workflow_worksheet(self, requested_path: str) -> Optional[Any]:
        """
        Try to find an already-open worksheet that corresponds to requested_path.
        This handles Save As flows where Mathcad changes worksheet name/path identity.
        """
        requested_key = self._normalize_worksheet_identity(Path(requested_path).name)
        if not requested_key:
            return None

        stale_equivalent_paths: List[str] = []

        for existing_path, worksheet in list(self.workflow_worksheets.items()):
            candidate_names = [Path(existing_path).name]
            try:
                ws_name = getattr(worksheet, "name", None)
                if ws_name:
                    candidate_names.append(str(ws_name))
            except Exception:
                pass

            is_equivalent = False
            for candidate in candidate_names:
                candidate_key = self._normalize_worksheet_identity(candidate)
                if not candidate_key:
                    continue
                # Exported names typically keep the original base name as prefix.
                if candidate_key == requested_key or candidate_key.startswith(requested_key):
                    is_equivalent = True
                    break

            if not is_equivalent:
                continue

            if self._probe_worksheet_reference(worksheet):
                return worksheet

            stale_equivalent_paths.append(existing_path)

        for stale_path in stale_equivalent_paths:
            self.workflow_worksheets.pop(stale_path, None)
            print(f"[workflow] Dropped stale equivalent reference: {Path(stale_path).name}")

        return None

    def _probe_worksheet_reference(self, worksheet: Any) -> bool:
        """Check if a worksheet COM reference is still usable."""
        if worksheet is None:
            return False
        try:
            _ = worksheet.name
            # Probe both sides per workflow requirement: inputs and outputs.
            worksheet.inputs()
            return True
        except Exception:
            return False

    def connect(self) -> bool:
        """
        Connects to the Mathcad Prime Application.
        MathcadPy handles COM initialization automatically.
        """
        try:
            self.mc = Mathcad(visible=True)
            print(f"Connected to Mathcad version: {self.mc.version}")
            return True
        except Exception as e:
            # Preserve the original message for non-designated input so callers can skip safely.
            if isinstance(e, ValueError) and "not a designated input field" in str(e):
                raise
            translated = translate_error(e)
            raise Exception(f"{translated['what']}\nWhy: {translated['why']}\nTry: {'; '.join(translated['try'][:2])}")

    def is_connected(self) -> bool:
        """Check if Mathcad connection is alive by testing COM accessibility."""
        if not self.mc:
            return False

        try:
            # Test COM connection by accessing a property that requires live connection
            # NOTE: Do NOT wrap in func_timeout - COM objects are STA (apartment-threaded)
            # and cannot be accessed from a different thread
            _ = self.mc.worksheet_names()
            return True
        except Exception as e:
            print(f"[worker] is_connected check failed: {e}")
            return False

    def _verify_worksheet(self) -> bool:
        """
        Verify that the current worksheet object is still valid.
        This checks both the app connection AND the worksheet handle.
        Returns True if worksheet is valid, False otherwise.
        """
        if not self.worksheet:
            return False

        # First check app connection
        if not self.is_connected():
            return False

        try:
            # Test worksheet validity by accessing a lightweight property
            # NOTE: Do NOT wrap in func_timeout - COM objects are STA
            _ = self.worksheet.name
            return True
        except Exception as e:
            # Worksheet handle is invalid
            print(f"[worker] Worksheet handle invalid ({e}), will reopen file")
            self.worksheet = None
            self.current_file_path = None
            return False

    def _ensure_worksheet_ready(self, retries: int = 2, delay: float = 0.5) -> None:
        """
        Ensure the worksheet is ready for operations. Reopens file if needed.
        Raises Exception if unable to recover.
        """
        for attempt in range(retries + 1):
            if self._verify_worksheet():
                return  # Worksheet is valid

            if not self.current_file_path:
                raise Exception("No worksheet loaded and no file path to reopen")

            if attempt < retries:
                print(f"Worksheet verification failed, attempting recovery (attempt {attempt + 1}/{retries})...")
                time.sleep(delay)
                try:
                    # Reconnect app if needed, then reopen file
                    if not self.is_connected():
                        self.connect()
                    self.open_file(self.current_file_path, force_reopen=True)
                    print("Worksheet recovery successful")
                    return
                except Exception as e:
                    print(f"Recovery attempt {attempt + 1} failed: {e}")
                    continue
            else:
                raise Exception("Worksheet is invalid and recovery failed after retries")

    def open_file(self, path: str, force_reopen: bool = False):
        """
        Open a Mathcad file. If the same file is already open, skip reopening unless force_reopen=True.
        This optimization significantly improves batch processing performance.
        """
        # Check if connection is alive, reconnect if necessary
        if not self.is_connected():
            print("Mathcad connection lost, reconnecting...")
            self.connect()

        abs_path = Path(path).resolve()
        if not abs_path.exists():
            raise FileNotFoundError(f"File not found: {abs_path}")

        # Performance optimization: Skip reopening if same file is already open and reference is usable.
        if not force_reopen and self.current_file_path == str(abs_path):
            if self._probe_worksheet_reference(self.worksheet):
                return
            print(f"[worker] Current reference stale for {abs_path.name}, reopening...")

        # Reuse workflow context reference first if available and usable.
        path_str = str(abs_path)
        if not force_reopen and path_str in self.workflow_worksheets:
            workflow_ws = self.workflow_worksheets[path_str]
            if self._probe_worksheet_reference(workflow_ws):
                self.worksheet = workflow_ws
                self.current_file_path = path_str
                try:
                    self.worksheet.activate()
                except Exception:
                    pass
                print(f"[worker] Reusing workflow worksheet reference: {abs_path.name}")
                return
            print(f"[worker] Workflow reference stale for {abs_path.name}, attempting reconnect...")
            if self.workflow_reconnect_worksheet(path_str):
                workflow_ws = self.workflow_worksheets.get(path_str)
                if workflow_ws is not None and self._probe_worksheet_reference(workflow_ws):
                    self.worksheet = workflow_ws
                    self.current_file_path = path_str
                    try:
                        self.worksheet.activate()
                    except Exception:
                        pass
                    print(f"[worker] Reconnected workflow worksheet reference: {abs_path.name}")
                    return

        try:
            # NOTE: Do NOT wrap in func_timeout - COM objects are STA (apartment-threaded)
            # and cannot be accessed from a different thread
            print(f"[worker] Opening file: {abs_path}")
            self.worksheet = self.mc.open(abs_path)
            self.worksheet.activate()
            self.current_file_path = path_str  # Track opened file
            print(f"[worker] File opened and activated: {abs_path}")
        except Exception as e:
            self.worksheet = None
            self.current_file_path = None
            translated = translate_error(e)
            raise Exception(f"{translated['what']}: {abs_path}\nWhy: {translated['why']}\nTry: {'; '.join(translated['try'][:2])}")

    def get_inputs(self) -> List[Dict[str, Any]]:
        self._ensure_worksheet_ready()
        try:
            input_names = self.worksheet.inputs()
            return [{"alias": name, "name": name, "units": ""} for name in input_names]
        except Exception as e:
            translated = translate_error(e)
            raise Exception(f"{translated['what']}\nWhy: {translated['why']}\nTry: {'; '.join(translated['try'][:2])}")

    def get_outputs(self) -> List[Dict[str, Any]]:
        self._ensure_worksheet_ready()
        try:
            output_names = self.worksheet.outputs()
            return [{"alias": name, "name": name, "units": ""} for name in output_names]
        except Exception as e:
            translated = translate_error(e)
            raise Exception(f"{translated['what']}\nWhy: {translated['why']}\nTry: {'; '.join(translated['try'][:2])}")

    def set_input(
        self,
        alias: str,
        value: Any,
        units: Optional[str] = None,
        preserve_units: Optional[bool] = None,
        allow_errors: bool = False,
    ):
        self._ensure_worksheet_ready()
        try:
            if isinstance(value, str):
                error = self.worksheet.set_string_input(alias, value)
                if error != 0:
                    raise Exception(f"set_string_input returned error code {error}")
            else:
                # Pass units to MathcadPy's set_real_input
                # Treat None, empty string, or "unitless" as no units
                is_unitless = units is None or units == "" or units.lower() == "unitless"
                units_param = "" if is_unitless else units

                # Default behavior preserves prior logic unless explicitly overridden.
                if preserve_units is None:
                    preserve_units = False
                
                error = self.worksheet.set_real_input(
                    alias, float(value), units=units_param, preserve_worksheet_units=preserve_units
                )
                if error != 0:
                    if allow_errors:
                        print(
                            f"[set_input] WARNING: set_real_input returned error code {error} "
                            f"for '{alias}' (allow_errors=True)"
                        )
                    else:
                        raise Exception(f"set_real_input returned error code {error}")
        except Exception as e:
            translated = translate_error(e)
            raise Exception(f"{translated['what']}\nWhy: {translated['why']}\nTry: {'; '.join(translated['try'][:2])}")

    def get_output_value(self, alias: str) -> Any:
        self._ensure_worksheet_ready()
        try:
            value, units, error_code = self.worksheet.get_real_output(alias)
            if error_code != 0:
                raise Exception(f"Error getting output {alias}: ErrorCode {error_code}")
            return value  # Unwrap tuple, return only value
        except Exception as e:
            raise Exception(f"Failed to get output {alias}: {str(e)}")

    def save_as(self, path: str, format_enum: Optional[int] = None):
        """
        Saves the current worksheet using MathcadPy's save_as method.
        MathcadPy auto-detects format from file extension.
        PDF export requires Mathcad Prime 5+.

        Args:
            path: Path to save the file to
            format_enum: Optional format enum (deprecated, auto-detected from extension)
        """
        self._ensure_worksheet_ready()

        abs_path = Path(path).resolve()

        # Determine if we are saving as PDF
        is_pdf = abs_path.suffix.lower() == ".pdf"

        if is_pdf:
             if self.mc.version_major_int <= 4:
                 raise ValueError("PDF export requires Mathcad Prime 5+")

        try:
            # NOTE: Do NOT wrap in func_timeout - COM objects are STA (apartment-threaded)
            # and cannot be accessed from a different thread
            print(f"[save_as] Saving to {abs_path}...")
            self.worksheet.save_as(abs_path)
            print(f"[save_as] Successfully saved to {abs_path}")
        except Exception as e:
            translated = translate_error(e)
            raise Exception(f"{translated['what']}\nWhy: {translated['why']}\nTry: {'; '.join(translated['try'][:2])}")

    # ==================== WORKFLOW-SPECIFIC METHODS ====================

    def workflow_validate_worksheet(self, path: str) -> Dict[str, Any]:
        """
        Validate that a workflow worksheet is still accessible and return its designated inputs.

        This checks:
        1. The worksheet reference exists in workflow_worksheets
        2. The COM connection is alive
        3. The worksheet.inputs() method works (probes Inputs.Count access)

        Returns dict with:
          - is_valid: bool - True if worksheet is accessible
          - inputs: list of designated input aliases (if valid)
          - error: error message (if invalid)
          - needs_reconnect: bool - True if reconnection was attempted

        This enables pre-execution validation before attempting to set inputs.
        """
        abs_path = str(Path(path).resolve())

        if abs_path not in self.workflow_worksheets:
            return {
                "is_valid": False,
                "inputs": [],
                "error": f"Worksheet not found in workflow: {Path(abs_path).name}",
                "needs_reconnect": False
            }

        worksheet = self.workflow_worksheets[abs_path]

        # Check COM connection first
        if not self.is_connected():
            return {
                "is_valid": False,
                "inputs": [],
                "error": "COM connection lost",
                "needs_reconnect": True
            }

        # Try to access worksheet properties to verify it's still alive
        if not self._probe_worksheet_reference(worksheet):
            return {
                "is_valid": False,
                "inputs": [],
                "error": "Worksheet reference probe failed (name/inputs/outputs unavailable)",
                "needs_reconnect": True
            }

        # Probe succeeded; now fetch designated inputs for validation metadata.
        try:
            designated_inputs = worksheet.inputs()
            return {
                "is_valid": True,
                "inputs": designated_inputs,
                "error": None,
                "needs_reconnect": False
            }
        except AttributeError as e:
            # ws_object.Inputs is None - COM reference stale
            return {
                "is_valid": False,
                "inputs": [],
                "error": f"COM reference stale: {e}",
                "needs_reconnect": True
            }
        except Exception as e:
            return {
                "is_valid": False,
                "inputs": [],
                "error": f"Failed to get inputs: {e}",
                "needs_reconnect": True
            }

    def workflow_reconnect_worksheet(self, path: str) -> bool:
        """
        Force reconnect a worksheet by removing the stale reference and reopening.

        Use this when workflow_validate_worksheet indicates needs_reconnect=True.
        Returns True if reconnection successful.
        """
        abs_path = str(Path(path).resolve())

        if abs_path not in self.workflow_worksheets:
            print(f"[workflow_reconnect] Worksheet not found: {Path(abs_path).name}")
            return False

        print(f"[workflow_reconnect] Reconnecting worksheet: {Path(abs_path).name}")

        # Remove stale reference
        del self.workflow_worksheets[abs_path]

        # Reopen the file
        try:
            if not self.is_connected():
                self.connect()
            self.workflow_open_file(abs_path)
            print(f"[workflow_reconnect] Reconnection successful: {Path(abs_path).name}")
            return True
        except Exception as e:
            print(f"[workflow_reconnect] Reconnection failed: {e}")
            return False

    def workflow_get_inputs(self, path: str) -> List[Dict[str, Any]]:
        """
        Get the designated inputs from a workflow worksheet.
        This is used for pre-execution validation.

        Returns list of input alias dicts with 'alias', 'name', 'units' keys.
        """
        abs_path = str(Path(path).resolve())

        if abs_path not in self.workflow_worksheets:
            raise Exception(f"Worksheet not found in workflow: {abs_path}")

        worksheet = self.workflow_worksheets[abs_path]
        self.worksheet = worksheet  # Set for compatibility

        # Validate and potentially reconnect if needed
        validation = self.workflow_validate_worksheet(abs_path)
        if not validation["is_valid"]:
            if validation["needs_reconnect"]:
                print(f"[workflow_get_inputs] Worksheet stale, attempting reconnect...")
                if not self.workflow_reconnect_worksheet(abs_path):
                    raise Exception(f"Failed to reconnect worksheet: {validation['error']}")
                worksheet = self.workflow_worksheets[abs_path]
                self.worksheet = worksheet
            else:
                raise Exception(f"Worksheet invalid: {validation['error']}")

        try:
            input_names = validation["inputs"]
            return [{"alias": name, "name": name, "units": ""} for name in input_names]
        except Exception as e:
            translated = translate_error(e)
            raise Exception(f"{translated['what']}\nWhy: {translated['why']}\nTry: {'; '.join(translated['try'][:2])}")

    def workflow_open_file(self, path: str):
        """
        Open a file for workflow processing. Unlike open_file(), this maintains
        multiple worksheet references for the entire workflow.

        Each opened worksheet gets its own reference stored in workflow_worksheets dict,
        similar to: test_ws1 = mathcad_app.open("file1.mcdx")
                    test_ws2 = mathcad_app.open("file2.mcdx")

        All worksheets remain open and can be accessed independently by path.
        Returns the worksheet object.
        """
        if not self.is_connected():
            print("Mathcad connection lost, reconnecting...")
            self.connect()

        abs_path = Path(path).resolve()
        if not abs_path.exists():
            raise FileNotFoundError(f"File not found: {abs_path}")

        path_str = str(abs_path)

        # Check if already opened in workflow context
        if path_str in self.workflow_worksheets:
            existing = self.workflow_worksheets[path_str]
            if self._probe_worksheet_reference(existing):
                print(f"Worksheet already open: {Path(path_str).name} (reusing reference)")
                return existing
            print(f"Worksheet reference stale: {Path(path_str).name}, reopening...")
            self.workflow_worksheets.pop(path_str, None)

        equivalent = self._find_equivalent_workflow_worksheet(path_str)
        if equivalent is not None:
            if self._probe_worksheet_reference(equivalent):
                self.workflow_worksheets[path_str] = equivalent
                print(f"Worksheet already open: {Path(path_str).name} (reusing equivalent reference)")
                return equivalent

        try:
            # Open and store worksheet reference (like test_ws1 = mathcad_app.open(...))
            worksheet = self.mc.open(abs_path)
            self.workflow_worksheets[path_str] = worksheet

            print(f"Opened workflow worksheet: {Path(path_str).name} (total open: {len(self.workflow_worksheets)})")

            # Note: Don't activate yet - activation happens when we need to process this step
            return worksheet
        except Exception as e:
            translated = translate_error(e)
            raise Exception(f"{translated['what']}\nWhy: {translated['why']}\nTry: {'; '.join(translated['try'][:2])}")

    def workflow_register_alias(self, source_path: str, alias_path: str):
        """Bind an additional path alias to an already-open workflow worksheet."""
        source_abs = str(Path(source_path).resolve())
        alias_abs = str(Path(alias_path).resolve())

        worksheet = self.workflow_worksheets.get(source_abs)
        if worksheet is None:
            return

        self.workflow_worksheets[alias_abs] = worksheet
        print(
            f"[workflow] Registered worksheet alias: "
            f"{Path(source_abs).name} -> {Path(alias_abs).name}"
        )

    def workflow_activate(self, path: str, activate: bool = False):
        """
        Set a specific worksheet as the current active reference in the workflow.
        NOTE: Does NOT call .activate() unless activate=True.

        Similar to: current_ws = test_ws2 (just setting reference, no activation)

        All worksheets remain open.
        """
        abs_path = str(Path(path).resolve())

        if abs_path not in self.workflow_worksheets:
            available = [Path(p).name for p in self.workflow_worksheets.keys()]
            raise Exception(f"Worksheet not found in workflow: {Path(abs_path).name}. Available: {available}")

        try:
            # Get the stored worksheet reference (like accessing test_ws2)
            worksheet = self.workflow_worksheets[abs_path]

            # Optionally activate the worksheet for operations that require it (e.g., SaveAs/PDF export)
            if activate:
                worksheet.activate()

            # Set as current worksheet for compatibility with other methods
            self.worksheet = worksheet
            self.current_file_path = abs_path

            print(f"Using worksheet: {Path(abs_path).name}")
        except Exception as e:
            translated = translate_error(e)
            raise Exception(f"{translated['what']}\nWhy: {translated['why']}\nTry: {'; '.join(translated['try'][:2])}")

    def workflow_set_inputs(self, path: str, inputs_config: List[Dict[str, Any]]):
        """
        Set inputs on a specific workflow worksheet.

        Similar to: test_ws1.set_real_input("Nr", 5, preserve_worksheet_units=False)

        This method validates the worksheet is accessible before setting inputs.
        If the COM reference is stale, it attempts to reconnect automatically.
        """
        abs_path = str(Path(path).resolve())

        if abs_path not in self.workflow_worksheets:
            raise Exception(f"Worksheet not found in workflow: {abs_path}")

        # Access the stored worksheet reference (like accessing test_ws1)
        worksheet = self.workflow_worksheets[abs_path]
        self.worksheet = worksheet  # Temporarily set for compatibility

        print(f"Setting {len(inputs_config)} input(s) on worksheet: {Path(abs_path).name}")

        # Validate worksheet is accessible - this also handles auto-reconnect
        validation = self.workflow_validate_worksheet(abs_path)
        if not validation["is_valid"]:
            if validation["needs_reconnect"]:
                print(f"[workflow_set_inputs] Worksheet stale (COM reference invalid), attempting reconnect...")
                if not self.workflow_reconnect_worksheet(abs_path):
                    raise Exception(f"Worksheet reconnection failed: {validation['error']}")
                # Refresh worksheet reference after reconnect
                worksheet = self.workflow_worksheets[abs_path]
                self.worksheet = worksheet
            else:
                raise Exception(f"Worksheet validation failed: {validation['error']}")

        # Validate against designated inputs to avoid MathcadPy ValueError
        try:
            designated_inputs = set(validation.get("inputs", []))
            if not designated_inputs:
                try:
                    # Some MathcadPy calls require activation to populate inputs
                    worksheet.activate()
                    designated_inputs = set(worksheet.inputs())
                except Exception as e:
                    print(f"[workflow_set_inputs] WARNING: Failed to activate/retry inputs: {e}")
        except Exception as e:
            print(f"[workflow_set_inputs] WARNING: Failed to list designated inputs: {e}")
            designated_inputs = set()

        for input_config in inputs_config:
            alias, value, units = extract_input_config(input_config)

            if alias and value is not None:
                if designated_inputs and alias not in designated_inputs:
                    print(f"[workflow_set_inputs] WARNING: Skipping input '{alias}' - not a designated input field")
                    continue
                print(f"[DEBUG] Setting input: alias={alias}, value={value}, type={type(value).__name__}")
                try:
                    # Preserve worksheet units when workflow input units are not provided.
                    is_unitless = units is None or units == "" or units.lower() == "unitless"
                    preserve_units = True if is_unitless else False
                    self.set_input(
                        alias,
                        value,
                        units,
                        preserve_units=preserve_units,
                        allow_errors=True,
                    )
                except Exception as e:
                    msg = str(e)
                    if "not a designated input field" in msg:
                        print(f"[workflow_set_inputs] WARNING: Skipping input '{alias}' - not a designated input field")
                        continue
                    raise

    def workflow_get_outputs(self, path: str, units_map: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        """
        Get outputs from a specific workflow worksheet.

        Args:
            path: Worksheet file path
            units_map: Optional dict of {alias: units} to retrieve outputs in specific units

        Similar to: test_ws1.get_real_output("out_1", units="in")
        """
        abs_path = str(Path(path).resolve())

        if abs_path not in self.workflow_worksheets:
            raise Exception(f"Worksheet not found in workflow: {abs_path}")

        # Access the stored worksheet reference (like accessing test_ws1)
        worksheet = self.workflow_worksheets[abs_path]
        self.worksheet = worksheet  # Temporarily set for compatibility

        # Get all outputs
        meta_outputs = self.get_outputs()
        output_data = {}

        for out_meta in meta_outputs:
            alias = out_meta["alias"]
            try:
                # Check if specific units requested for this output
                requested_units = units_map.get(alias) if units_map else None

                if requested_units:
                    # Get output in specific units
                    value, units, error_code = self.worksheet.get_real_output(alias, units=requested_units)
                    if error_code != 0:
                        raise Exception(f"Error getting output {alias}: ErrorCode {error_code}")
                else:
                    # Get output in its native/display units
                    value, units, error_code = self.worksheet.get_real_output(alias)
                    if error_code != 0:
                        raise Exception(f"Error getting output {alias}: ErrorCode {error_code}")

                # Store value (units come from WorkflowFile.output_units, not Mathcad computed units)
                output_data[alias] = value
            except Exception as e:
                output_data[alias] = f"Error: {str(e)}"

        print(f"Retrieved {len(output_data)} output(s) from worksheet: {Path(abs_path).name}")

        return output_data

    def workflow_get_open_worksheets(self) -> List[str]:
        """
        Get list of all currently open workflow worksheets.
        Returns list of file paths.
        """
        return list(self.workflow_worksheets.keys())

    def workflow_clear(self):
        """Clear all workflow worksheet references. Call this when workflow is deleted."""
        count = len(self.workflow_worksheets)
        if count > 0:
            worksheets = [Path(p).name for p in self.workflow_worksheets.keys()]
            print(f"Clearing {count} workflow worksheet(s): {', '.join(worksheets)}")
        self.workflow_worksheets.clear()

    def evaluate_row(self, inputs_config: List[Dict[str, Any]], units_map: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        """
        Evaluate a single row of inputs and return all outputs.
        Does NOT save any files. Optimized for high-speed loops.

        Args:
            inputs_config: List of input configs with alias, value, and optional units
            units_map: Optional dict of {alias: units} to retrieve outputs in specific units
        """
        self._ensure_worksheet_ready()

        # Set Inputs
        for input_config in inputs_config:
            alias, value, units = extract_input_config(input_config)

            if alias and value is not None:
                self.set_input(alias, value, units)

        # Get all outputs with optional unit conversion
        output_names = self.worksheet.outputs()
        output_data = {}
        for alias in output_names:
            try:
                requested_units = units_map.get(alias) if units_map else None
                if requested_units:
                    value, units, error_code = self.worksheet.get_real_output(alias, units=requested_units)
                    if error_code != 0:
                        output_data[alias] = f"Error: ErrorCode {error_code}"
                    else:
                        output_data[alias] = value
                else:
                    value, units, error_code = self.worksheet.get_real_output(alias)
                    if error_code != 0:
                        output_data[alias] = f"Error: ErrorCode {error_code}"
                    else:
                        output_data[alias] = value
            except Exception as e:
                output_data[alias] = f"Error: {str(e)}"

        return output_data
