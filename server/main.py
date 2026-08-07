import asyncio
import time
import calendar
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from models import Post, PostPatch
from config import bluesky_credentials
from adapters.registry import (
    get_adapter, invalidate, is_live, is_supported, make_real_adapter, PLATFORM_IDS,
)
from db import (
    init_db, list_posts, upsert_post, patch_post, get_post, delete_post,
    get_credentials, set_credentials, delete_credentials, MEDIA_DIR, add_media, get_media
)
POLL_SECONDS = 3
METRICS_REFRESH_SECONDS = 300

def _parse_iso(s: str) -> datetime:
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt

def _add_months(dt: datetime, months: int) -> datetime:
    m = dt.month - 1 + months
    year = dt.year + m // 12
    month = m % 12 + 1
    day = min(dt.day, calendar.monthrange(year, month)[1])   # clamp e.g. Jan 31 -> Feb 28
    return dt.replace(year=year, month=month, day=day)


def _next_occurrence(iso: str, repeat: str, now: datetime) -> datetime | None:
    dt = _parse_iso(iso)
    if repeat == "daily":
        step = lambda d: d + timedelta(days=1)
    elif repeat == "weekly":
        step = lambda d: d + timedelta(days=7)
    elif repeat == "monthly":
        step = lambda d: _add_months(d, 1)
    else:
        return None
    nxt = step(dt)
    while nxt <= now:            # collapse missed windows: exactly one make-up, next in future
        nxt = step(nxt)
    return nxt

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

    # Recurring: spawn the next occurrence regardless of outcome (a transient
    # failure shouldn't break the chain). The successor is always in the future.
    repeat = post.get("repeat", "none")
    if repeat and repeat != "none":
        now = datetime.now(timezone.utc)
        nxt = _next_occurrence(post["scheduledAt"], repeat, now)
        if nxt:
            upsert_post(Post(
                id=f"post_{uuid.uuid4().hex}",
                text=post["text"],
                platforms=post["platforms"],
                scheduledAt=nxt.isoformat(),
                status="scheduled",
                repeat=repeat,
                createdAt=int(now.timestamp() * 1000),
            ))

async def _publish_due():
    now = datetime.now(timezone.utc)
    for post in list_posts():
        if post["status"] == "scheduled" and _parse_iso(post["scheduledAt"]) <= now:
            await _publish(post)

async def _refresh_all_metrics(since_days: int = 14):
    cutoff = datetime.now(timezone.utc) - timedelta(days=since_days)
    for post in list_posts():
        if post["status"] != "published":
            continue
        if _parse_iso(post["scheduledAt"]) < cutoff:
            continue          # engagement on old posts has settled; skip to bound API calls
        metrics = {}
        for platform_id, result in post["results"].items():
            if result.get("ok") and result.get("ref"):
                try:
                    metrics[platform_id] = await get_adapter(platform_id).fetch_metrics(result["ref"])
                except Exception as e:
                    print(f"[metrics] {post['id']} {platform_id}: {e}")
        if metrics:
            patch_post(post["id"], {"metrics": metrics})

async def _worker():
    last_metrics = 0.0
    while True:
        try:
            await _publish_due()
        except Exception as e:
            print(f"[worker] error: {e}")

        now = time.monotonic()
        if now - last_metrics >= METRICS_REFRESH_SECONDS:
            last_metrics = now                      # 0.0 start => also runs once right after boot
            try:
                await _refresh_all_metrics()
            except Exception as e:
                print(f"[worker] metrics error: {e}")

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
    existing = get_post(post_id)
    if existing is None:
        raise HTTPException(404, "Post not found")
    # Don't let content be edited once it's on its way out.
    if {"text", "platforms", "scheduledAt"} & changes.keys() \
            and existing["status"] in ("publishing", "published"):
        raise HTTPException(409, "Can't edit a post that's already publishing or published")
    updated = patch_post(post_id, changes)
    if updated is None:
        raise HTTPException(404, "Post not found")
    return updated


@app.delete("/posts/{post_id}")
def remove_post(post_id: str) -> dict:
    delete_post(post_id)
    return {"ok": True, "id": post_id}

# ---- metrics ----
@app.post("/metrics/refresh")
async def refresh_metrics() -> list[dict]:
    await _refresh_all_metrics()
    return list_posts()

REQUIRED_FIELDS = {
    "bluesky":  ["handle", "app_password"],
    "mastodon": ["instance_url", "access_token"],
}


# ---- media ----
@app.post("/media")
async def upload_media(file: UploadFile = File(...)) -> dict:
    media_id = f"media_{uuid.uuid4().hex}"
    data = await file.read()
    (MEDIA_DIR / media_id).write_bytes(data)
    add_media(media_id, file.content_type or "application/octet-stream",
              file.filename or media_id, len(data))
    return {"id": media_id, "url": f"/media/{media_id}", "content_type": file.content_type}


@app.get("/media/{media_id}")
def serve_media(media_id: str):
    meta = get_media(media_id)
    path = MEDIA_DIR / media_id
    if meta is None or not path.exists():
        raise HTTPException(404, "Media not found")
    return FileResponse(path, media_type=meta["content_type"], filename=meta["filename"])

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

    data = {}
    for field in REQUIRED_FIELDS.get(platform, []):
        val = (creds.get(field) or "").strip()
        if not val:
            raise HTTPException(422, f"{field} is required")
        data[field] = val

    try:
        resolved = await make_real_adapter(platform, data).verify()   # logs in / validates
    except Exception as e:
        raise HTTPException(400, f"Could not connect: {e}")

    if resolved:
        data["handle"] = resolved

    set_credentials(platform, data)
    invalidate(platform)
    return {"id": platform, "supported": True, "connected": True, "account": data.get("handle")}


@app.delete("/accounts/{platform}")
def disconnect_account(platform: str) -> dict:
    delete_credentials(platform)
    invalidate(platform)
    return {"id": platform, "supported": is_supported(platform), "connected": False, "account": None}