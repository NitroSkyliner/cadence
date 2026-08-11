import os
import sys
from pathlib import Path


def app_data_dir() -> Path:
    if sys.platform == "darwin":
        base = Path.home() / "Library" / "Application Support"
    elif sys.platform.startswith("win"):
        base = Path(os.environ.get("APPDATA", Path.home()))
    else:
        base = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share"))
    d = base / "Cadence"
    d.mkdir(parents=True, exist_ok=True)
    return d


DATA = app_data_dir()
os.environ.setdefault("DATA_DIR", str(DATA))
os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173,tauri://localhost,http://tauri.localhost")

# Persist an encryption key in the data dir if none was provided.
if not os.environ.get("CADENCE_SECRET_KEY"):
    keyfile = DATA / "secret.key"
    if not keyfile.exists():
        from cryptography.fernet import Fernet
        keyfile.write_bytes(Fernet.generate_key())
    os.environ["CADENCE_SECRET_KEY"] = keyfile.read_text().strip()

import uvicorn          # noqa: E402
from main import app    # noqa: E402

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")