import httpx
import asyncio
from db import load_media_bytes
from .base import Adapter


class MastodonAdapter(Adapter):
    def __init__(self, instance_url: str, access_token: str):
        super().__init__("mastodon")
        self._base = instance_url.rstrip("/")
        self._token = access_token

    def _headers(self):
        return {"Authorization": f"Bearer {self._token}"}

    async def verify(self) -> str | None:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                f"{self._base}/api/v1/accounts/verify_credentials",
                headers=self._headers(),
            )
            r.raise_for_status()
            acct = r.json().get("acct")
            host = self._base.split("://")[-1]
            return f"@{acct}@{host}" if acct else None

    async def publish(self, post: dict) -> dict:
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                media_ids = []
                for mid in post.get("media", [])[:4]:
                    loaded = load_media_bytes(mid)
                    if not loaded:
                        continue
                    data, content_type = loaded
                    up = await client.post(
                        f"{self._base}/api/v2/media",
                        headers=self._headers(),
                        files={"file": (mid, data, content_type)},
                    )
                    up.raise_for_status()
                    remote_id = up.json()["id"]
                    if up.status_code == 202:                 # async processing (e.g. video)
                        await self._wait_for_media(client, remote_id)
                    media_ids.append(remote_id)

                form = {"status": post["text"]}
                if media_ids:
                    form["media_ids[]"] = media_ids           # httpx repeats the key per id
                r = await client.post(
                    f"{self._base}/api/v1/statuses",
                    headers={**self._headers(), "Idempotency-Key": post["id"]},
                    data=form,
                )
                r.raise_for_status()
                return {"ok": True, "ref": str(r.json()["id"])}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    async def _wait_for_media(self, client, remote_id, attempts=8):
        delay = 1.0
        for _ in range(attempts):
            await asyncio.sleep(delay)
            r = await client.get(
                f"{self._base}/api/v1/media/{remote_id}",
                headers=self._headers(),
            )
            if r.status_code == 200:      # 200 = ready; 206 = still processing
                return
            delay = min(delay * 1.5, 8)

    async def fetch_metrics(self, ref: str) -> dict:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                f"{self._base}/api/v1/statuses/{ref}",
                headers=self._headers(),
            )
            r.raise_for_status()
            s = r.json()
            return {
                "likes":   s.get("favourites_count", 0) or 0,
                "reposts": s.get("reblogs_count", 0) or 0,
                "replies": s.get("replies_count", 0) or 0,
            }