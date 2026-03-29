# src/engine/utils.py
"""Shared utilities for engine module."""
from typing import Any, Optional, Tuple

from .protocol import JobResult


def extract_input_config(config) -> Tuple[str, Any, Optional[str]]:
    """Extract alias, value, units from input config (dict or Pydantic model).

    Args:
        config: InputConfig as dict or Pydantic model

    Returns:
        Tuple of (alias, value, units)
    """
    if isinstance(config, dict):
        return config.get("alias"), config.get("value"), config.get("units")
    return config.alias, config.value, config.units


def wrap_com_error(e: Exception) -> Exception:
    """Translate COM error to user-friendly message.

    Args:
        e: Original exception from COM operation

    Returns:
        Exception with translated message
    """
    from .error_translator import translate_error

    translated = translate_error(e)
    return Exception(
        f"{translated['what']}\n"
        f"Why: {translated['why']}\n"
        f"Try: {'; '.join(translated['try'][:2])}"
    )
