"""
OpenedFilesTracker for tracking opened Mathcad files with file-based persistence.

Provides persistence of the opened files list so users can see what files
were open when reconnecting after accidental frontend disconnect.
"""

import json
from pathlib import Path
from platformdirs import user_data_dir
from typing import List, Optional
from datetime import datetime


class OpenedFilesTracker:
    """
    Tracker for opened Mathcad files with immediate file-based persistence.

    Maintains a list of currently opened file paths that persists to disk
    on every add/remove operation. This allows the frontend to recover
    the list of opened files after disconnect.

    State file location: {AppData}/Local/MathcadAutomator/MathcadAutomator/state/opened_files.json

    File structure:
    {
        "files": ["/path/to/file1.mcdx", "/path/to/file2.mcdx"],
        "last_updated": "2026-02-21T10:30:00"
    }
    """

    STATE_FILENAME = "opened_files.json"

    def __init__(self, app_name: str = "MathcadAutomator"):
        """
        Initialize the opened files tracker.

        Args:
            app_name: Application name for directory resolution.
                      Defaults to "MathcadAutomator".
        """
        self.state_dir: Path = Path(user_data_dir(app_name)) / "state"
        self.state_dir.mkdir(parents=True, exist_ok=True)
        self.state_file: Path = self.state_dir / self.STATE_FILENAME

    def add_file(self, file_path: str) -> None:
        """
        Add a file to the opened files list and persist immediately.

        Prevents duplicates - if file already in list, no change is made
        but last_updated timestamp is still refreshed.

        Args:
            file_path: Absolute path to the opened file
        """
        files = self.list_files()

        # Normalize path for comparison
        normalized_path = str(Path(file_path).resolve())

        if normalized_path not in files:
            files.append(normalized_path)

        self._persist(files)

    def remove_file(self, file_path: str) -> None:
        """
        Remove a file from the opened files list and persist immediately.

        If file is not in list, no error is raised but last_updated
        timestamp is still refreshed.

        Args:
            file_path: Absolute path to the closed file
        """
        files = self.list_files()

        # Normalize path for comparison
        normalized_path = str(Path(file_path).resolve())

        if normalized_path in files:
            files.remove(normalized_path)

        self._persist(files)

    def list_files(self) -> List[str]:
        """
        Return the list of currently opened file paths.

        Returns:
            List of absolute file paths. Empty list if no state file exists.
        """
        if not self.state_file.exists():
            return []

        try:
            content = self.state_file.read_text(encoding="utf-8")
            data = json.loads(content)
            return data.get("files", [])
        except (json.JSONDecodeError, KeyError, IOError):
            # Corrupted or unreadable file - return empty list
            return []

    def clear_all(self) -> None:
        """
        Clear all files from the opened files list.

        Useful for cleanup or testing. Persists empty list immediately.
        """
        self._persist([])

    def _persist(self, files: List[str]) -> None:
        """
        Persist the file list to disk using atomic write pattern.

        Writes to a temp file first, then replaces the target file.
        This prevents corruption if crash happens during write.

        Args:
            files: List of file paths to persist
        """
        data = {
            "files": files,
            "last_updated": datetime.now().isoformat()
        }

        content = json.dumps(data, indent=2, ensure_ascii=False)

        # Atomic write: write to temp file, then replace
        temp_path = self.state_file.with_suffix(".tmp")
        temp_path.write_text(content, encoding="utf-8")
        temp_path.replace(self.state_file)
