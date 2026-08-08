import asyncio
import time
import calendar
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse
from oauth import is_oauth, new_state, consume_state, build_authorize_url, exchange_code
from fastapi.middleware.cors import CORSMiddleware

from models import Post, PostPatch
from config import bluesky_credentials
from adapters.registry import (
    get_adapter, invalidate, is_supported, make_real_adapter, PLATFORM_IDS,
)
from db import (
    init_db, list_posts, upsert_post, patch_post, get_post, delete_post,
    list_connections, get_connection, set_connection, delete_connection, resolve_target,
    MEDIA_DIR, add_media, get_media,
)
from oauth import is_oauth, new_state, consume_state, build_authorize_url, exchange_code

POLL_SECONDS = 3
METRICS_REFRESH_SECONDS = 300

def _popup_close_html(error: str | None) -> str:
    payload = "cadence-oauth-error" if error else "cadence-oauth-done"
    msg = error or "Connected. You can close this window."
    return f"""<!doctype html><meta charset="utf-8">
<body style="font-family:system-ui;background:#0A1220;color:#F5F7FA;display:grid;place-items:center;height:100vh;margin:0">
<div style="text-align:center"><p>{msg}</p></div>
<script>try{{window.opener&&window.opener.postMessage("{payload}","*")}}catch(e){{}}
setTimeout(function(){{window.close()}},800)</script>"""

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
    from oauth import is_oauth, refresh_if_needed
    patch_post(post["id"], {"status": "publishing"})
    results = {}
    for target in post["platforms"]:
        conn = resolve_target(target)
        if conn is None:
            results[target] = {"ok": False, "error": "account not connected"}
            continue
        if is_oauth(conn["platform"]):
            await refresh_if_needed(conn["id"])           # keep token fresh before posting
        try:
            results[target] = await get_adapter(target).publish(post)
        except Exception as e:
            results[target] = {"ok": False, "error": str(e)}
    all_ok = all(r.get("ok") for r in results.values())
    patch_post(post["id"], {"status": "published" if all_ok else "failed", "results": results})

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
        for target, result in post["results"].items():
            if result.get("ok") and result.get("ref"):
                try:
                    metrics[target] = await get_adapter(target).fetch_metrics(result["ref"])
                except Exception as e:
                    print(f"[metrics] {post['id']} {target}: {e}")
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
    if not list_connections("bluesky"):
        creds = bluesky_credentials()
        if creds:
            set_connection("bluesky", creds[0], {"handle": creds[0], "app_password": creds[1]})
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
REQUIRED_FIELDS = {
    "bluesky":  ["handle", "app_password"],
    "mastodon": ["instance_url", "access_token"],
}


@app.get("/accounts")
def get_accounts() -> list[dict]:
    out = []
    for pid in PLATFORM_IDS:
        conns = list_connections(pid)
        out.append({
            "id": pid,
            "oauth": is_oauth(pid),
            "supported": is_supported(pid) or is_oauth(pid),
            "connections": [{"id": c["id"], "handle": c["handle"]} for c in conns],
        })
    return out


@app.post("/accounts/{platform}")
async def connect_account(platform: str, creds: dict) -> dict:
    if platform not in PLATFORM_IDS:
        raise HTTPException(404, "Unknown platform")
    if not is_supported(platform):
        raise HTTPException(400, f"{platform} isn't supported for token connect")
    data = {}
    for field in REQUIRED_FIELDS.get(platform, []):
        val = (creds.get(field) or "").strip()
        if not val:
            raise HTTPException(422, f"{field} is required")
        data[field] = val
    try:
        resolved = await make_real_adapter(platform, data).verify()
    except Exception as e:
        raise HTTPException(400, f"Could not connect: {e}")
    handle = resolved or data.get("handle") or platform
    data["handle"] = handle
    cid = set_connection(platform, handle, data)
    invalidate(cid)
    return {"id": cid, "handle": handle}


@app.delete("/accounts/{platform}/{handle}")
def disconnect_account(platform: str, handle: str) -> dict:
    from db import make_conn_id
    cid = make_conn_id(platform, handle)
    delete_connection(cid)
    invalidate(cid)
    return {"ok": True, "id": cid}


@app.get("/accounts/{platform}/oauth/start")
def oauth_start(platform: str):
    if not is_oauth(platform):
        raise HTTPException(400, f"{platform} does not use OAuth")
    return RedirectResponse(build_authorize_url(platform, new_state(platform)))


@app.get("/accounts/{platform}/oauth/callback", response_class=HTMLResponse)
async def oauth_callback(platform: str, code: str = "", state: str = "", error: str = ""):
    if error:
        return _popup_close_html(f"Cancelled: {error}")
    if consume_state(state) != platform:
        return _popup_close_html("Invalid or expired state")
    try:
        cid = await exchange_code(platform, code)
    except Exception as e:
        return _popup_close_html(f"Token exchange failed: {e}")
    invalidate(cid)
    return _popup_close_html(None)


# ---- mock OAuth provider (stands in for a real platform until you register an app) ----
@app.get("/mock-oauth/authorize", response_class=HTMLResponse)
def mock_authorize(redirect_uri: str = "", state: str = "", scope: str = ""):
    from urllib.parse import urlencode
    approve = f"{redirect_uri}?{urlencode({'code': 'mock-auth-code', 'state': state})}"
    deny = f"{redirect_uri}?{urlencode({'error': 'access_denied', 'state': state})}"
    return f"""<!doctype html><meta charset="utf-8">
<body style="font-family:system-ui;background:#0A1220;color:#F5F7FA;display:grid;place-items:center;height:100vh;margin:0">
<div style="text-align:center;max-width:360px">
  <h2 style="font-weight:600;margin:0 0 8px">Mock provider</h2>
  <p style="color:#9BA7B6">Authorize <b>Cadence</b> to post on your behalf?<br>
  <span style="font-family:monospace;font-size:12px">scope: {scope}</span></p>
  <div style="display:flex;gap:8px;justify-content:center;margin-top:18px">
    <a href="{approve}" style="background:#FF5C38;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none">Authorize</a>
    <a href="{deny}" style="border:1px solid #22334A;color:#9BA7B6;padding:10px 18px;border-radius:10px;text-decoration:none">Cancel</a>
  </div>
</div>"""


@app.post("/mock-oauth/token")
def mock_token() -> dict:
    return {
        "access_token": f"mock-access-{uuid.uuid4().hex}",
        "refresh_token": f"mock-refresh-{uuid.uuid4().hex}",
        "expires_in": 3600, "token_type": "bearer",
        "scope": "mock", "username": "@you (mock)",
    }