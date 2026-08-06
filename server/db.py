import json
import sqlite3
from pathlib import Path
from contextlib import contextmanager

from models import Post

DB_PATH = Path(__file__).parent / "cadence.db"


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
                createdAt   INTEGER NOT NULL
            )
        """)
        # Migration for DBs created before the metrics column existed.
        cols = {r["name"] for r in c.execute("PRAGMA table_info(posts)").fetchall()}
        if "metrics" not in cols:
            c.execute("ALTER TABLE posts ADD COLUMN metrics TEXT NOT NULL DEFAULT '{}'")


def _row_to_post(row) -> dict:
    return {
        "id": row["id"],
        "text": row["text"],
        "platforms": json.loads(row["platforms"]),
        "scheduledAt": row["scheduledAt"],
        "status": row["status"],
        "results": json.loads(row["results"]),
        "metrics": json.loads(row["metrics"]),
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
               (id, text, platforms, scheduledAt, status, results, metrics, createdAt)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                post.id,
                post.text,
                json.dumps(post.platforms),
                post.scheduledAt,
                post.status,
                json.dumps({k: v.model_dump() for k, v in post.results.items()}),
                json.dumps({k: v.model_dump() for k, v in post.metrics.items()}),
                post.createdAt,
            ),
        )
    return post.model_dump()


def patch_post(post_id: str, changes: dict) -> dict | None:
    existing = get_post(post_id)
    if existing is None:
        return None
    existing.update(changes)
    with _conn() as c:
        c.execute(
            "UPDATE posts SET status = ?, results = ?, metrics = ? WHERE id = ?",
            (
                existing["status"],
                json.dumps(existing["results"]),
                json.dumps(existing["metrics"]),
                post_id,
            ),
        )
    return existing