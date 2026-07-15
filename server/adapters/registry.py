from .mock import MockAdapter
from .bluesky import BlueskyAdapter
from config import bluesky_credentials

PLATFORM_IDS = ["bluesky", "mastodon", "instagram", "x", "linkedin"]

_registry = {pid: MockAdapter(pid) for pid in PLATFORM_IDS}

_bsky = bluesky_credentials()
if _bsky:
    _registry["bluesky"] = BlueskyAdapter(*_bsky)
    print(f"[registry] Bluesky LIVE as {_bsky[0]}")
else:
    print("[registry] Bluesky on MOCK (no credentials in .env)")


def get_adapter(platform_id: str):
    adapter = _registry.get(platform_id)
    if adapter is None:
        raise ValueError(f'No adapter registered for "{platform_id}"')
    return adapter