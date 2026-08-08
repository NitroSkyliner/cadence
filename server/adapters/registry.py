from .mock import MockAdapter
from .bluesky import BlueskyAdapter
from .mastodon import MastodonAdapter
from db import get_connection, resolve_target

PLATFORM_IDS = ["bluesky", "mastodon", "threads", "instagram", "x", "linkedin"]


def _build_bluesky(c):  return BlueskyAdapter(c["handle"], c["app_password"])
def _build_mastodon(c): return MastodonAdapter(c["instance_url"], c["access_token"])

_BUILDERS = {
    "bluesky": _build_bluesky,
    "mastodon": _build_mastodon,
}

_cache = {}   # connection id -> adapter


def _make_adapter(platform, creds):
    builder = _BUILDERS.get(platform)
    if builder and creds:
        try:
            return builder(creds)
        except Exception as e:
            print(f"[registry] failed to build real {platform}: {e}")
    return MockAdapter(platform)


def get_adapter(target: str):
    """target = connection id ('bluesky:me') or legacy bare platform ('bluesky')."""
    conn = resolve_target(target)
    if conn is None:
        raise ValueError(f'No connection for "{target}"')
    cid = conn["id"]
    if cid not in _cache:
        _cache[cid] = _make_adapter(conn["platform"], conn["data"])
    return _cache[cid]


def make_real_adapter(platform, creds):
    builder = _BUILDERS.get(platform)
    if not builder:
        raise ValueError(f"{platform} has no real adapter")
    return builder(creds)


def invalidate(conn_id=None):
    if conn_id is None:
        _cache.clear()
    else:
        _cache.pop(conn_id, None)


def is_supported(platform):
    return platform in _BUILDERS