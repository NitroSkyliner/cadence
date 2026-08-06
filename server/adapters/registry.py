from .mock import MockAdapter
from .bluesky import BlueskyAdapter
from db import get_credentials
from .mastodon import MastodonAdapter

PLATFORM_IDS = ["bluesky", "mastodon", "instagram", "x", "linkedin"]


def _build_bluesky(creds):
    return BlueskyAdapter(creds["handle"], creds["app_password"])


# platform_id -> builder(creds) -> real Adapter. Add real platforms here.
_BUILDERS = {
    "bluesky": _build_bluesky,
    "mastodon": _build_mastodon,
}

_cache = {}   # platform_id -> live adapter instance


def _make_adapter(platform_id):
    builder = _BUILDERS.get(platform_id)
    creds = get_credentials(platform_id)
    if builder and creds:
        try:
            return builder(creds)
        except Exception as e:
            print(f"[registry] failed to build real {platform_id}: {e}")
    return MockAdapter(platform_id)


def get_adapter(platform_id):
    if platform_id not in PLATFORM_IDS:
        raise ValueError(f'No adapter registered for "{platform_id}"')
    if platform_id not in _cache:
        _cache[platform_id] = _make_adapter(platform_id)
    return _cache[platform_id]


def make_real_adapter(platform_id, creds):
    """Build a real adapter from given creds (used to verify before saving)."""
    builder = _BUILDERS.get(platform_id)
    if not builder:
        raise ValueError(f"{platform_id} has no real adapter")
    return builder(creds)


def invalidate(platform_id):
    _cache.pop(platform_id, None)


def is_supported(platform_id):
    return platform_id in _BUILDERS


def is_live(platform_id):
    return bool(_BUILDERS.get(platform_id) and get_credentials(platform_id))

def _build_mastodon(creds):
    return MastodonAdapter(creds["instance_url"], creds["access_token"])