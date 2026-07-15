import os
from pathlib import Path

ENV_PATH = Path(__file__).parent / ".env"


def _load_env():
    if not ENV_PATH.exists():
        return
    for line in ENV_PATH.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_env()


def bluesky_credentials():
    """Return (handle, app_password) if both are set, else None."""
    handle = os.environ.get("BLUESKY_HANDLE")
    password = os.environ.get("BLUESKY_APP_PASSWORD")
    return (handle, password) if handle and password else None