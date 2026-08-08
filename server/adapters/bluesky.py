from atproto import AsyncClient

from .base import Adapter
from db import load_media_bytes
from db import read_media

class BlueskyAdapter(Adapter):
    def __init__(self, handle: str, app_password: str):
        super().__init__("bluesky")
        self._handle = handle
        self._app_password = app_password
        self._client = None                      # cached logged-in session

    async def _get_client(self) -> AsyncClient:
        if self._client is None:
            client = AsyncClient()
            await client.login(self._handle, self._app_password)
            self._client = client
        return self._client

    async def publish(self, post: dict) -> dict:
        try:
            client = await self._get_client()

            images, alts = [], []
            for mid in post.get("media", [])[:4]:      # Bluesky allows up to 4
                loaded = load_media_bytes(mid)
                if loaded:
                    images.append(loaded[0])
                    alts.append("")                    # alt text: wired in a later pass

            medias = [m for m in (read_media(mid) for mid in post.get("media", [])) if m]
            if any(m["is_video"] for m in medias):
                return {"ok": False,
                        "error": "Bluesky video isn't supported yet (needs the video service + a verified email)"}

            images = medias[:4]                          # Bluesky allows up to 4 images
            if images:
                response = await client.send_images(
                    text=post["text"],
                    images=[m["bytes"] for m in images],
                    image_alts=[m["alt"] for m in images],   # real alt text now
                )
            else:
                response = await client.send_post(text=post["text"])

            return {"ok": True, "ref": response.uri}
        except Exception as e:
            self._client = None
            return {"ok": False, "error": str(e)}

    async def fetch_metrics(self, ref: str) -> dict:
        try:
            client = await self._get_client()
            response = await client.get_posts([ref])
            post = response.posts[0] if response.posts else None
            return {
                "likes":   (post.like_count   if post else 0) or 0,
                "reposts": (post.repost_count if post else 0) or 0,
                "replies": (post.reply_count  if post else 0) or 0,
            }
        except Exception:
            self._client = None
            raise
    async def verify(self) -> str | None:
        await self._get_client()          # logs in; raises if handle/password are wrong
        return self._handle