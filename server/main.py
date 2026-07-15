import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from models import Post, PostPatch
from db import init_db, list_posts, upsert_post, patch_post
from adapters.registry import get_adapter

POLL_SECONDS = 3


def _parse_iso(s: str) -> datetime:
    # Normalize a trailing 'Z' so fromisoformat works across all Python 3.x.
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


async def _publish(post: dict):
    patch_post(post["id"], {"status": "publishing"})
    results = {}
    for platform_id in post["platforms"]:
        try:
            results[platform_id] = await get_adapter(platform_id).publish(post)
        except Exception as e:
            results[platform_id] = {"ok": False, "error": str(e)}
    all_ok = all(r.get("ok") for r in results.values())
    patch_post(post["id"], {
        "status": "published" if all_ok else "failed",
        "results": results,
    })


async def _publish_due():
    now = datetime.now(timezone.utc)
    for post in list_posts():
        if post["status"] == "scheduled" and _parse_iso(post["scheduledAt"]) <= now:
            await _publish(post)


async def _worker():
    while True:
        try:
            await _publish_due()
        except Exception as e:
            print(f"[worker] error: {e}")
        await asyncio.sleep(POLL_SECONDS)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    task = asyncio.create_task(_worker())          # start the always-on worker
    yield
    task.cancel()                                  # stop it on shutdown


app = FastAPI(title="Cadence API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/posts")
def get_posts() -> list[dict]:
    return list_posts()


@app.post("/posts")
def create_post(post: Post) -> dict:
    return upsert_post(post)


@app.patch("/posts/{post_id}")
def update_post(post_id: str, patch: PostPatch) -> dict:
    changes = patch.model_dump(exclude_unset=True)
    updated = patch_post(post_id, changes)
    if updated is None:
        raise HTTPException(status_code=404, detail="Post not found")
    return updated