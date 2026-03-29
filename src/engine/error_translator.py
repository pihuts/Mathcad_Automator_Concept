"""
Error translator module for converting COM errors to user-friendly messages.

Per ERR-03 requirement, this module translates cryptic COM/pywin32 exceptions
into actionable guidance for engineers using Mathcad Automator.

Categories per CONTEXT.md locked decision:
- connection: Mathcad not found, COM server issues, RPC unavailable
- file: cannot open, file not found, access denied
- calculation: recalc failed, calculation errors, error codes
- permission: permission denied, read-only, locked files
"""

from typing import Dict, Any, List

ERROR_CATEGORIES: Dict[str, Dict[str, Any]] = {
    "connection": {
        "patterns": [
            "Mathcad not found",
            "COM server",
            "RPC",
            "-2147023174",  # RPC_S_SERVER_UNAVAILABLE
            "0x800706ba",   # RPC_S_SERVER_UNAVAILABLE hex
            "no such interface",
            "object disconnected",
            "call was rejected",
            "application not running",
        ],
        "template": {
            "what": "Cannot connect to Mathcad",
            "why": "Mathcad Prime is not running or not installed correctly",
            "try": [
                "Start Mathcad Prime and try again",
                "Check that Mathcad Prime is installed",
                "Restart Mathcad Prime if it is already running",
                "Reinstall Mathcad if the problem persists",
            ],
        },
    },
    "file": {
        "patterns": [
            "cannot open",
            "file not found",
            "access denied",
            "path not found",
            "invalid file",
            "corrupt",
        ],
        "template": {
            "what": "Cannot open worksheet file",
            "why": "The file may be missing, moved, corrupted, or inaccessible",
            "try": [
                "Check that the file path is correct",
                "Verify the file exists and is a valid .mcdx file",
                "Close the file in Mathcad if it is already open",
                "Check file permissions",
            ],
        },
    },
    "calculation": {
        "patterns": [
            "recalc",
            "calculation failed",
            "error code",
            "calculation error",
            "undefined",
            "division by zero",
        ],
        "template": {
            "what": "Worksheet calculation failed",
            "why": "A formula in the worksheet encountered an error or produced an undefined result",
            "try": [
                "Open the worksheet in Mathcad to see error locations",
                "Check that all input values are valid for the formulas",
                "Look for division by zero or undefined variables",
                "Verify units are consistent throughout the worksheet",
            ],
        },
    },
    "permission": {
        "patterns": [
            "permission denied",
            "read-only",
            "locked",
            "file in use",
            "sharing violation",
            "cannot save",
        ],
        "template": {
            "what": "File is locked or read-only",
            "why": "Another program or user has the file open, or the file is marked read-only",
            "try": [
                "Close the file in Mathcad or other applications",
                "Save to a different location if you need to preserve changes",
                "Check if the file is on a read-only network share",
                "Contact your IT administrator if the file should be editable",
            ],
        },
    },
}


def translate_error(original_error: Exception) -> Dict[str, Any]:
    """
    Translate a COM error to a user-friendly message with actionable guidance.

    Args:
        original_error: The exception that occurred during a COM operation

    Returns:
        A dictionary containing:
        - category: Error category (connection, file, calculation, permission, unknown)
        - what: Brief description of what happened
        - why: Simplified explanation of why it happened
        - try: List of actionable suggestions
        - debug_info: Original error string for debugging
    """
    error_str = str(original_error).lower()

    for category, config in ERROR_CATEGORIES.items():
        for pattern in config["patterns"]:
            if pattern.lower() in error_str:
                return {
                    "category": category,
                    **config["template"],
                    "debug_info": str(original_error),
                }

    # Fallback for unknown errors
    return {
        "category": "unknown",
        "what": "An unexpected error occurred",
        "why": "The operation could not be completed due to an unknown issue",
        "try": [
            "Try the operation again",
            "Check that Mathcad Prime is responsive",
            "Restart Mathcad Prime if the problem persists",
            "Check the application logs for more details",
        ],
        "debug_info": str(original_error),
    }
