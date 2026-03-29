"""
Library Service for configuration persistence.

Handles saving, loading, listing, and deleting configuration templates
for both batch operations and workflows.
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel


class LibraryService:
    """
    Service for managing saved configuration templates.

    Supports two config types:
    - "batch": Batch configurations stored next to the source .mcdx file
    - "workflow": Workflow configurations stored in a central workflow_library directory

    Usage:
        service = LibraryService()

        # Save a batch config
        config_path = service.save_config("batch", "my-config", {
            "name": "my-config",
            "file_path": "/path/to/file.mcdx",
            "inputs": [...],
            ...
        })

        # Load it back
        config = service.load_config("batch", "my-config", source_file="/path/to/file.mcdx")

        # List all configs for a file
        configs = service.list_configs("batch", source_file="/path/to/file.mcdx")

        # Delete a config
        service.delete_config("batch", "my-config", source_file="/path/to/file.mcdx")
    """

    VALID_CONFIG_TYPES = {"batch", "workflow"}

    def __init__(self, project_root: Optional[Path] = None):
        """
        Initialize the library service.

        Args:
            project_root: Root directory for the workflow library.
                         Defaults to current working directory.
        """
        self.project_root = Path(project_root) if project_root else Path.cwd()

    def _validate_config_type(self, config_type: str) -> None:
        """Validate that config_type is supported."""
        if config_type not in self.VALID_CONFIG_TYPES:
            raise ValueError(
                f"Invalid config_type '{config_type}'. "
                f"Must be one of: {sorted(self.VALID_CONFIG_TYPES)}"
            )

    def _sanitize_name(self, name: str) -> str:
        """
        Sanitize a config name for use as a filename.

        Removes or replaces characters that are unsafe for filenames.
        """
        safe_name = "".join(
            c for c in name if c.isalnum() or c in (" ", "-", "_")
        ).strip()
        # Normalize to lowercase for consistency on case-insensitive filesystems
        return safe_name.lower()

    def _get_batch_config_dir(self, source_file: Union[str, Path]) -> Path:
        """
        Get the config directory for batch configs associated with a source file.

        Configs are stored in: {source_file_parent}/{source_file_stem}_configs/
        """
        source_path = Path(source_file)
        if not source_path.exists():
            raise FileNotFoundError(f"Source file not found: {source_file}")
        return source_path.parent / f"{source_path.stem}_configs"

    def _get_workflow_library_dir(self) -> Path:
        """
        Get the workflow library directory.

        Workflows are stored in: {project_root}/workflow_library/
        """
        return self.project_root / "workflow_library"

    @staticmethod
    def _is_within(path: Path, root: Path) -> bool:
        try:
            path.resolve().relative_to(root.resolve())
            return True
        except ValueError:
            return False

    def save_config(
        self,
        config_type: str,
        name: str,
        data: Dict[str, Any],
        source_file: Optional[Union[str, Path]] = None,
    ) -> Path:
        """
        Save a configuration with the given name.

        Args:
            config_type: "batch" or "workflow"
            name: Display name for the config
            data: Configuration data (will be validated if contains required fields)
            source_file: Required for batch configs - the associated .mcdx file

        Returns:
            Path to the saved config file

        Raises:
            ValueError: If config_type is invalid or required params missing
            FileNotFoundError: If source_file doesn't exist (batch configs)
        """
        self._validate_config_type(config_type)

        if config_type == "batch":
            if not source_file:
                raise ValueError("source_file is required for batch configs")
            return self._save_batch_config(name, data, Path(source_file))
        else:
            return self._save_workflow_config(name, data)

    def _save_batch_config(
        self, name: str, data: Dict[str, Any], source_file: Path
    ) -> Path:
        """Save a batch configuration next to the source file."""
        config_dir = self._get_batch_config_dir(source_file)
        config_dir.mkdir(exist_ok=True)

        safe_name = self._sanitize_name(name)
        config_file = config_dir / f"{safe_name}.json"

        # Convert paths to relative for portability
        config_dict = data.copy()
        config_dict["file_path"] = str(source_file.name)

        if config_dict.get("output_dir"):
            try:
                output_rel = str(Path(config_dict["output_dir"]).relative_to(source_file.parent))
                config_dict["output_dir"] = output_rel
            except ValueError:
                # Different drive or not relative - keep as is
                pass

        # Ensure metadata fields
        if "created_at" not in config_dict:
            config_dict["created_at"] = datetime.now().isoformat()
        if "version" not in config_dict:
            config_dict["version"] = "1.0"

        config_file.write_text(
            json.dumps(config_dict, indent=2, default=str),
            encoding="utf-8"
        )
        return config_file

    def _save_workflow_config(self, name: str, data: Dict[str, Any]) -> Path:
        """Save a workflow configuration to the central library."""
        library_dir = self._get_workflow_library_dir()
        library_dir.mkdir(exist_ok=True)

        safe_name = self._sanitize_name(name)
        config_file = library_dir / f"{safe_name}.json"

        config_dict = data.copy()

        # Determine base path for relative paths
        base_path = library_dir.parent

        # Convert file paths to relative
        for file_entry in config_dict.get("files", []):
            if file_entry.get("file_path"):
                try:
                    rel_path = str(Path(file_entry["file_path"]).relative_to(base_path))
                    file_entry["file_path"] = rel_path
                except ValueError:
                    # Different drive - keep absolute
                    pass

        # Convert output_dir to relative
        if config_dict.get("output_dir"):
            try:
                output_rel = str(Path(config_dict["output_dir"]).relative_to(base_path))
                config_dict["output_dir"] = output_rel
            except ValueError:
                pass

        # Ensure metadata fields
        if "created_at" not in config_dict:
            config_dict["created_at"] = datetime.now().isoformat()
        if "version" not in config_dict:
            config_dict["version"] = "1.0"

        config_file.write_text(
            json.dumps(config_dict, indent=2, default=str),
            encoding="utf-8"
        )
        return config_file

    def load_config(
        self,
        config_type: str,
        name: str,
        source_file: Optional[Union[str, Path]] = None,
        config_path: Optional[Union[str, Path]] = None,
    ) -> Dict[str, Any]:
        """
        Load a configuration by name.

        Args:
            config_type: "batch" or "workflow"
            name: Display name of the config (ignored if config_path provided)
            source_file: Required for batch configs if not using config_path
            config_path: Direct path to config file (bypasses name lookup)

        Returns:
            Configuration dict with absolute paths resolved

        Raises:
            FileNotFoundError: If config file doesn't exist
            ValueError: If config_type is invalid or required params missing
        """
        self._validate_config_type(config_type)

        if config_path:
            return self._load_config_by_path(Path(config_path), config_type)

        if config_type == "batch":
            if not source_file:
                raise ValueError("source_file is required for batch configs")
            return self._load_batch_config(name, Path(source_file))
        else:
            return self._load_workflow_config(name)

    def _load_config_by_path(
        self, config_path: Path, config_type: str
    ) -> Dict[str, Any]:
        """Load a config file by its direct path."""
        if config_path.suffix.lower() != ".json":
            raise PermissionError("Only .json configuration files are allowed")

        resolved_path = config_path.resolve()
        if config_type == "workflow":
            workflow_root = self._get_workflow_library_dir().resolve()
            if not self._is_within(resolved_path, workflow_root):
                raise PermissionError(
                    f"Workflow config path escapes workflow library: {config_path}"
                )
        elif config_type == "batch":
            if not resolved_path.parent.name.endswith("_configs"):
                raise PermissionError(
                    f"Batch config path must be inside a *_configs directory: {config_path}"
                )

        if not resolved_path.exists():
            raise FileNotFoundError(f"Config file not found: {config_path}")

        config_dict = json.loads(resolved_path.read_text(encoding="utf-8"))

        # Resolve relative paths based on config type
        if config_type == "batch":
            base_path = resolved_path.parent.parent
            if config_dict.get("file_path"):
                resolved = (base_path / config_dict["file_path"]).resolve()
                config_dict["file_path"] = str(resolved)
            if config_dict.get("output_dir"):
                resolved = (base_path / config_dict["output_dir"]).resolve()
                config_dict["output_dir"] = str(resolved)
        else:
            base_path = resolved_path.parent.parent
            for file_entry in config_dict.get("files", []):
                if file_entry.get("file_path"):
                    resolved = (base_path / file_entry["file_path"]).resolve()
                    file_entry["file_path"] = str(resolved)
            if config_dict.get("output_dir"):
                resolved = (base_path / config_dict["output_dir"]).resolve()
                config_dict["output_dir"] = str(resolved)

        return config_dict

    def _load_batch_config(self, name: str, source_file: Path) -> Dict[str, Any]:
        """Load a batch configuration by name."""
        config_dir = self._get_batch_config_dir(source_file)
        safe_name = self._sanitize_name(name)
        config_file = config_dir / f"{safe_name}.json"

        if not config_file.exists():
            raise FileNotFoundError(
                f"Config '{name}' not found for file {source_file}"
            )

        return self._load_config_by_path(config_file, "batch")

    def _load_workflow_config(self, name: str) -> Dict[str, Any]:
        """Load a workflow configuration by name."""
        library_dir = self._get_workflow_library_dir()
        safe_name = self._sanitize_name(name)
        config_file = library_dir / f"{safe_name}.json"

        if not config_file.exists():
            raise FileNotFoundError(f"Workflow config '{name}' not found")

        return self._load_config_by_path(config_file, "workflow")

    def list_configs(
        self,
        config_type: str,
        source_file: Optional[Union[str, Path]] = None,
    ) -> List[Dict[str, Any]]:
        """
        List all saved configurations.

        Args:
            config_type: "batch" or "workflow"
            source_file: Required for batch configs

        Returns:
            List of config metadata dicts with keys:
            - name: Display name
            - path: Full path to config file
            - created_at: Creation timestamp
            - version: Config version string
            - (workflow only) files_count: Number of files in workflow
        """
        self._validate_config_type(config_type)

        if config_type == "batch":
            if not source_file:
                raise ValueError("source_file is required for batch configs")
            return self._list_batch_configs(Path(source_file))
        else:
            return self._list_workflow_configs()

    def _list_batch_configs(self, source_file: Path) -> List[Dict[str, Any]]:
        """List batch configs for a source file."""
        config_dir = self._get_batch_config_dir(source_file)

        if not config_dir.exists():
            return []

        configs = []
        for config_file in config_dir.glob("*.json"):
            try:
                config_data = json.loads(config_file.read_text(encoding="utf-8"))
                configs.append({
                    "name": config_data.get("name", config_file.stem),
                    "path": str(config_file),
                    "created_at": config_data.get("created_at", "unknown"),
                    "version": config_data.get("version", "1.0"),
                })
            except (json.JSONDecodeError, Exception):
                # Skip corrupted config files
                continue

        return configs

    def _list_workflow_configs(self) -> List[Dict[str, Any]]:
        """List all workflow configs in the library."""
        library_dir = self._get_workflow_library_dir()

        if not library_dir.exists():
            return []

        configs = []
        for config_file in library_dir.glob("*.json"):
            try:
                config_data = json.loads(config_file.read_text(encoding="utf-8"))
                configs.append({
                    "name": config_data.get("name", config_file.stem),
                    "path": str(config_file),
                    "created_at": config_data.get("created_at", "unknown"),
                    "files_count": len(config_data.get("files", [])),
                    "version": config_data.get("version", "1.0"),
                })
            except (json.JSONDecodeError, Exception):
                continue

        return configs

    def delete_config(
        self,
        config_type: str,
        name: str,
        source_file: Optional[Union[str, Path]] = None,
    ) -> bool:
        """
        Delete a saved configuration.

        Args:
            config_type: "batch" or "workflow"
            name: Display name of the config to delete
            source_file: Required for batch configs

        Returns:
            True if config was deleted, False if it didn't exist

        Raises:
            ValueError: If config_type is invalid or required params missing
        """
        self._validate_config_type(config_type)

        if config_type == "batch":
            if not source_file:
                raise ValueError("source_file is required for batch configs")
            return self._delete_batch_config(name, Path(source_file))
        else:
            return self._delete_workflow_config(name)

    def _delete_batch_config(self, name: str, source_file: Path) -> bool:
        """Delete a batch configuration."""
        config_dir = self._get_batch_config_dir(source_file)
        safe_name = self._sanitize_name(name)
        config_file = config_dir / f"{safe_name}.json"

        if not config_file.exists():
            return False

        config_file.unlink()
        return True

    def _delete_workflow_config(self, name: str) -> bool:
        """Delete a workflow configuration."""
        library_dir = self._get_workflow_library_dir()
        safe_name = self._sanitize_name(name)
        config_file = library_dir / f"{safe_name}.json"

        if not config_file.exists():
            return False

        config_file.unlink()
        return True

    def config_exists(
        self,
        config_type: str,
        name: str,
        source_file: Optional[Union[str, Path]] = None,
    ) -> bool:
        """
        Check if a configuration exists.

        Args:
            config_type: "batch" or "workflow"
            name: Display name of the config
            source_file: Required for batch configs

        Returns:
            True if config exists, False otherwise
        """
        self._validate_config_type(config_type)

        try:
            if config_type == "batch":
                if not source_file:
                    return False
                config_dir = self._get_batch_config_dir(Path(source_file))
            else:
                config_dir = self._get_workflow_library_dir()

            safe_name = self._sanitize_name(name)
            config_file = config_dir / f"{safe_name}.json"
            return config_file.exists()
        except (FileNotFoundError, ValueError):
            return False
