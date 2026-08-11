import os
import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

_PREFIX = "enc:v1:"


def _load_cipher():
    raw = os.environ.get("CADENCE_SECRET_KEY")
    if not raw:
        print("[crypto] CADENCE_SECRET_KEY not set — credentials stored in PLAINTEXT. "
              "Set a key before deploying.")
        return None
    # Accept either a real Fernet key or any passphrase (hashed into a valid key).
    try:
        return Fernet(raw.encode())
    except Exception:
        digest = hashlib.sha256(raw.encode()).digest()
        return Fernet(base64.urlsafe_b64encode(digest))


_cipher = _load_cipher()


def encrypt(plaintext: str) -> str:
    if _cipher is None or plaintext.startswith(_PREFIX):
        return plaintext
    return _PREFIX + _cipher.encrypt(plaintext.encode()).decode()


def decrypt(value: str) -> str:
    if not value.startswith(_PREFIX):
        return value                     # legacy plaintext row
    if _cipher is None:
        raise RuntimeError("Encrypted data present but CADENCE_SECRET_KEY is not set")
    try:
        return _cipher.decrypt(value[len(_PREFIX):].encode()).decode()
    except InvalidToken:
        raise RuntimeError("CADENCE_SECRET_KEY does not match the encrypted data")


def is_enabled() -> bool:
    return _cipher is not None