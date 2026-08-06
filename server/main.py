import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from models import Post, PostPatch
from db import (
    init_db, list_posts, upsert_post, patch_post,
    get_credentials, set_credentials, delete_credentials,
)
from config import bluesky_credentials
from adapters.registry import (
    get_adapter, invalidate, is_live, is_supported, make_real_adapter, PLATFORM_IDS,
)

POLL_SECONDS = 3


def _parse_iso(s: str) -> datetime:
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


def _seed_from_env():
    # One-time: import .env Bluesky creds into the DB if nothing's stored yet.
    if get_credentials("bluesky") is None:
        creds = bluesky_credentials()
        if creds:
            set_credentials("bluesky", {"handle": creds[0], "app_password": creds[1]})
            print(f"[seed] imported Bluesky creds from .env for {creds[0]}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    _seed_from_env()
    task = asyncio.create_task(_worker())
    yield
    task.cancel()


app = FastAPI(title="Cadence API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---- posts ----
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


# ---- metrics ----
@app.post("/metrics/refresh")
async def refresh_metrics() -> list[dict]:
    for post in list_posts():
        if post["status"] != "published":
            continue
        metrics = {}
        for platform_id, result in post["results"].items():
            if result.get("ok") and result.get("ref"):
                try:
                    metrics[platform_id] = await get_adapter(platform_id).fetch_metrics(result["ref"])
                except Exception as e:
                    print(f"[metrics] {post['id']} {platform_id}: {e}")
        if metrics:
            patch_post(post["id"], {"metrics": metrics})
    return list_posts()


# ---- accounts ----
@app.get("/accounts")
def get_accounts() -> list[dict]:
    out = []
    for pid in PLATFORM_IDS:
        creds = get_credentials(pid)
        out.append({
            "id": pid,
            "supported": is_supported(pid),
            "connected": is_live(pid),
            "account": creds.get("handle") if creds else None,   # never the secret
        })
    return out


@app.post("/accounts/{platform}")
async def connect_account(platform: str, creds: dict) -> dict:
    if platform not in PLATFORM_IDS:
        raise HTTPException(404, "Unknown platform")
    if not is_supported(platform):
        raise HTTPException(400, f"{platform} isn't supported for real posting yet")

    if platform == "bluesky":
        handle = (creds.get("handle") or "").strip()
        app_password = (creds.get("app_password") or "").strip()
        if not handle or not app_password:
            raise HTTPException(422, "handle and app_password are required")
        data = {"handle": handle, "app_password": app_password}
    else:
        data = creds

    try:
        await make_real_adapter(platform, data).verify()      # log in before saving
    except Exception as e:
        raise HTTPException(400, f"Could not connect: {e}")

    set_credentials(platform, data)
    invalidate(platform)
    return {"id": platform, "supported": True, "connected": True, "account": data.get("handle")}


@app.delete("/accounts/{platform}")
def disconnect_account(platform: str) -> dict:
    delete_credentials(platform)
    invalidate(platform)
    return {"id": platform, "supported": is_supported(platform), "connected": False, "account": None}