import json
import time
import sqlite3
from pathlib import Path
from contextlib import contextmanager

from models import Post

BASE = Path(__file__).parent
DB_PATH = BASE / "cadence.db"
MEDIA_DIR = BASE / "media"
MEDIA_DIR.mkdir(exist_ok=True)

_JSON_COLS = {"platforms", "results", "metrics", "media"}
_MUTABLE = {"text", "platforms", "scheduledAt", "status", "results", "metrics", "repeat", "media"}


@contextmanager
def _conn():
    conn = sqlite3.connect(DB_PATH, timeout=5)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    with _conn() as c:
        c.execute("""
            CREATE TABLE IF NOT EXISTS posts (
                id          TEXT PRIMARY KEY,
                text        TEXT NOT NULL,
                platforms   TEXT NOT NULL,
                scheduledAt TEXT NOT NULL,
                status      TEXT NOT NULL,
                results     TEXT NOT NULL,
                metrics     TEXT NOT NULL DEFAULT '{}',
                repeat      TEXT NOT NULL DEFAULT 'none',
                media       TEXT NOT NULL DEFAULT '[]',
                createdAt   INTEGER NOT NULL
            )
        """)
        cols = {r["name"] for r in c.execute("PRAGMA table_info(posts)").fetchall()}
        if "metrics" not in cols:
            c.execute("ALTER TABLE posts ADD COLUMN metrics TEXT NOT NULL DEFAULT '{}'")
        if "repeat" not in cols:
            c.execute("ALTER TABLE posts ADD COLUMN repeat TEXT NOT NULL DEFAULT 'none'")
        if "media" not in cols:
            c.execute("ALTER TABLE posts ADD COLUMN media TEXT NOT NULL DEFAULT '[]'")
        c.execute("""
            CREATE TABLE IF NOT EXISTS credentials (
                platform     TEXT PRIMARY KEY,
                data         TEXT NOT NULL,
                connected_at INTEGER NOT NULL
            )
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS media (
                id           TEXT PRIMARY KEY,
                content_type TEXT NOT NULL,
                filename     TEXT NOT NULL,
                size         INTEGER NOT NULL,
                created_at   INTEGER NOT NULL
            )
        """)


def _row_to_post(row) -> dict:
    return {
        "id": row["id"],
        "text": row["text"],
        "platforms": json.loads(row["platforms"]),
        "scheduledAt": row["scheduledAt"],
        "status": row["status"],
        "results": json.loads(row["results"]),
        "metrics": json.loads(row["metrics"]),
        "repeat": row["repeat"],
        "media": json.loads(row["media"]),
        "createdAt": row["createdAt"],
    }


def list_posts() -> list[dict]:
    with _conn() as c:
        rows = c.execute("SELECT * FROM posts ORDER BY scheduledAt").fetchall()
    return [_row_to_post(r) for r in rows]


def get_post(post_id: str) -> dict | None:
    with _conn() as c:
        row = c.execute("SELECT * FROM posts WHERE id = ?", (post_id,)).fetchone()
    return _row_to_post(row) if row else None


def upsert_post(post: Post) -> dict:
    with _conn() as c:
        c.execute(
            """INSERT OR REPLACE INTO posts
               (id, text, platforms, scheduledAt, status, results, metrics, repeat, media, createdAt)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                post.id,
                post.text,
                json.dumps(post.platforms),
                post.scheduledAt,
                post.status,
                json.dumps({k: v.model_dump() for k, v in post.results.items()}),
                json.dumps({k: v.model_dump() for k, v in post.metrics.items()}),
                post.repeat,
                json.dumps(post.media),
                post.createdAt,
            ),
        )
    return post.model_dump()


def patch_post(post_id: str, changes: dict) -> dict | None:
    existing = get_post(post_id)
    if existing is None:
        return None
    fields = {k: v for k, v in changes.items() if k in _MUTABLE}
    if not fields:
        return existing
    existing.update(fields)
    sets, values = [], []
    for k in fields:
        sets.append(f"{k} = ?")
        values.append(json.dumps(existing[k]) if k in _JSON_COLS else existing[k])
    values.append(post_id)
    with _conn() as c:
        c.execute(f"UPDATE posts SET {', '.join(sets)} WHERE id = ?", values)
    return existing


def delete_post(post_id: str):
    with _conn() as c:
        c.execute("DELETE FROM posts WHERE id = ?", (post_id,))


def get_credentials(platform: str) -> dict | None:
    with _conn() as c:
        row = c.execute("SELECT data FROM credentials WHERE platform = ?", (platform,)).fetchone()
    return json.loads(row["data"]) if row else None


def set_credentials(platform: str, data: dict):
    with _conn() as c:
        c.execute(
            "INSERT OR REPLACE INTO credentials (platform, data, connected_at) VALUES (?, ?, ?)",
            (platform, json.dumps(data), int(time.time() * 1000)),
        )


def delete_credentials(platform: str):
    with _conn() as c:
        c.execute("DELETE FROM credentials WHERE platform = ?", (platform,))


def add_media(media_id: str, content_type: str, filename: str, size: int):
    with _conn() as c:
        c.execute(
            "INSERT INTO media (id, content_type, filename, size, created_at) VALUES (?, ?, ?, ?, ?)",
            (media_id, content_type, filename, size, int(time.time() * 1000)),
        )


def get_media(media_id: str) -> dict | None:
    with _conn() as c:
        row = c.execute("SELECT * FROM media WHERE id = ?", (media_id,)).fetchone()
    return dict(row) if row else None