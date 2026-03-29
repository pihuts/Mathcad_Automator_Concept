"""Global settings for the Mathcad engine."""
import os
from dataclasses import dataclass


@dataclass
class Settings:
    """Global engine settings."""
    overwrite_existing: bool = True  # default: overwrite existing PDF/MCDX files


def get_settings() -> Settings:
    """Return Settings singleton, reading MATHCAD_OVERWRITE_EXISTING env var at startup."""
    env_val = os.environ.get("MATHCAD_OVERWRITE_EXISTING", "").lower()
    if env_val in ("false", "0", "no"):
        overwrite = False
    elif env_val in ("true", "1", "yes"):
        overwrite = True
    else:
        overwrite = True  # matches current batch behavior
    return Settings(overwrite_existing=overwrite)


# Module-level singleton — initialized once at import time
settings = get_settings()
