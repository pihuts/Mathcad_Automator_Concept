"""
File Service for file system operations.

Handles file browsing dialogs, folder selection, and native file opening.
Uses a subprocess-based approach for tkinter dialogs to avoid threading issues
with FastAPI's asyncio event loop.
"""

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


class FileService:
    """
    Service for file system operations.

    Provides methods for:
    - browse_file: Open native file picker dialog
    - browse_folder: Open native folder picker dialog
    - open_file: Open a file with the system default application

    Thread Safety:
        The browse_file and browse_folder methods use tkinter which must
        run in a separate thread when called from async code. Use
        asyncio.to_thread() to wrap these calls:

        file_path = await asyncio.to_thread(service.browse_file, filters)
    """

    # Default file filter presets
    DEFAULT_MATHCAD_FILTERS = [
        ("Mathcad Prime", "*.mcdx"),
        ("All files", "*.*"),
    ]
    DIALOG_TIMEOUT_SECONDS = 60

    def __init__(self):
        """Initialize the file service."""
        pass

    def browse_file(
        self,
        filters: Optional[List[Tuple[str, str]]] = None,
        title: str = "Select File",
    ) -> Optional[str]:
        """
        Open a native file dialog and return the selected path.

        Uses a subprocess to run the tkinter dialog, avoiding asyncio threading issues.

        Args:
            filters: List of (description, pattern) tuples for file type filters.
                     Example: [("Mathcad Prime", "*.mcdx"), ("All files", "*.*")]
                     Defaults to Mathcad file filter if not provided.
            title: Dialog window title.

        Returns:
            Selected file path as string, or None if cancelled.

        Usage:
            # Async usage (in route handler)
            path = await asyncio.to_thread(service.browse_file)
        """
        # Build command to run tk_helper subprocess
        script_path = Path(__file__).parent / "tk_helper.py"
        filetypes_json = json.dumps(filters) if filters else "null"

        try:
            result = subprocess.run(
                [sys.executable, str(script_path), "browse_file", title, filetypes_json],
                capture_output=True,
                text=True,
                timeout=self.DIALOG_TIMEOUT_SECONDS,
            )
            # Result is printed to stdout by tk_helper
            file_path = result.stdout.strip()
            return file_path if file_path else None
        except subprocess.TimeoutExpired:
            print("[file_service] File dialog timed out")
            return None
        except Exception as e:
            print(f"[file_service] File dialog error: {e}")
            return None

    def browse_folder(
        self,
        title: str = "Select Folder",
    ) -> Optional[str]:
        """
        Open a native folder picker dialog and return the selected path.

        Uses a subprocess to run the tkinter dialog, avoiding asyncio threading issues.

        Args:
            title: Dialog window title.

        Returns:
            Selected folder path as string, or None if cancelled.

        Usage:
            # Async usage (in route handler)
            path = await asyncio.to_thread(service.browse_folder)
        """
        # Build command to run tk_helper subprocess
        script_path = Path(__file__).parent / "tk_helper.py"

        try:
            result = subprocess.run(
                [sys.executable, str(script_path), "browse_folder", title],
                capture_output=True,
                text=True,
                timeout=self.DIALOG_TIMEOUT_SECONDS,
            )
            # Result is printed to stdout by tk_helper
            folder_path = result.stdout.strip()
            return folder_path if folder_path else None
        except subprocess.TimeoutExpired:
            print("[file_service] Folder dialog timed out")
            return None
        except Exception as e:
            print(f"[file_service] Folder dialog error: {e}")
            return None

    def open_file(self, path: str) -> Dict[str, Any]:
        """
        Open a file using the system default application.

        Args:
            path: Path to the file to open.

        Returns:
            Dict with keys:
            - status: "success" or "error"
            - error: Error message if status is "error"

        Raises:
            FileNotFoundError: If the file does not exist.
            ValueError: If path is empty or invalid.
        """
        if not path:
            raise ValueError("Path cannot be empty")

        file_path = Path(path)
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {path}")

        try:
            # Use startfile on Windows, open on Mac, xdg-open on Linux
            if hasattr(os, 'startfile'):
                os.startfile(str(file_path))
            elif sys.platform == 'darwin':
                subprocess.call(['open', str(file_path)])
            else:
                subprocess.call(['xdg-open', str(file_path)])

            return {"status": "success"}
        except Exception as e:
            return {"status": "error", "error": str(e)}

    def validate_path(
        self,
        path: str,
        must_exist: bool = True,
        must_be_file: bool = False,
        must_be_dir: bool = False,
    ) -> Tuple[bool, Optional[str]]:
        """
        Validate a file system path.

        Args:
            path: Path to validate.
            must_exist: If True, path must exist on disk.
            must_be_file: If True, path must be a file (not directory).
            must_be_dir: If True, path must be a directory (not file).

        Returns:
            Tuple of (is_valid, error_message).
            error_message is None if valid.
        """
        if not path:
            return False, "Path cannot be empty"

        try:
            p = Path(path)

            if must_exist and not p.exists():
                return False, f"Path does not exist: {path}"

            if must_be_file and p.exists() and not p.is_file():
                return False, f"Path is not a file: {path}"

            if must_be_dir and p.exists() and not p.is_dir():
                return False, f"Path is not a directory: {path}"

            return True, None
        except Exception as e:
            return False, f"Invalid path: {str(e)}"
