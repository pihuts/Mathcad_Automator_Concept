"""
Services package for Mathcad Automator API.

This package contains business logic services that encapsulate operations
used by route handlers. Services provide a clean separation between
HTTP request handling and core business logic.

Architecture:
- Routes handle HTTP concerns (request parsing, response formatting, error codes)
- Services handle business logic (file operations, library management, validation)
- Engine layer handles Mathcad COM interaction

Planned Services:
- LibraryService: Configuration library CRUD operations, template management
- FileService: File system operations, path validation, file browsing
- ValidationService: Input validation and sanitization for engineering data
- SettingsService: Application settings persistence and retrieval

Usage:
    Services are instantiated with required dependencies (config paths, etc.)
    and injected into route handlers via FastAPI's dependency injection.

    Example:
        from src.server.services import LibraryService

        def get_library_service() -> LibraryService:
            return LibraryService(config_path=SETTINGS.config_dir)

        @router.get("/library")
        async def list_library(
            service: LibraryService = Depends(get_library_service),
        ):
            return service.list_entries()
"""

# Service exports will be added here as modules are created
# Example:
# from .library import LibraryService
# from .files import FileService

from typing import List
from .library_service import LibraryService
from .file_service import FileService

__all__: List[str] = [
    "LibraryService",
    "FileService",
    # "ValidationService",
    # "SettingsService",
]
