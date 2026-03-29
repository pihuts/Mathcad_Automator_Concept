import threading
from typing import Optional

from src.engine.manager import EngineManager

# Singleton instance
_manager: Optional[EngineManager] = None
_manager_lock = threading.Lock()

def get_engine_manager() -> EngineManager:
    global _manager
    if _manager is None:
        with _manager_lock:
            if _manager is None:
                _manager = EngineManager()
    return _manager
