import time
import asyncio
import httpx
from atproto import AsyncClient, models

from .base import Adapter
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

                medias = [m for m in (read_media(mid) for mid in post.get("media", [])) if m]
                videos = [m for m in medias if m["is_video"]]

                if videos:
                    embed = await self._video_embed(client, videos[0])     # 1 video per post
                    response = await client.send_post(text=post["text"], embed=embed)
                else:
                    images = medias[:4]
                    if images:
                        response = await client.send_images(
                            text=post["text"],
                            images=[m["bytes"] for m in images],
                            image_alts=[m["alt"] for m in images],
                        )
                    else:
                        response = await client.send_post(text=post["text"])

                thread = post.get("thread") or []
                first_comment = (post.get("first_comment") or "").strip()
                root_ref = None
                if thread or first_comment:
                    root_ref = models.create_strong_ref(response)

                parent_ref = root_ref
                for seg in thread:
                    seg = seg.strip()
                    if not seg:
                        continue
                    reply = await client.send_post(
                        text=seg,
                        reply_to=models.AppBskyFeedPost.ReplyRef(parent=parent_ref, root=root_ref),
                    )
                    parent_ref = models.create_strong_ref(reply)

                if first_comment:
                    await client.send_post(          # replies to the ROOT, not the thread tail
                        text=first_comment,
                        reply_to=models.AppBskyFeedPost.ReplyRef(parent=root_ref, root=root_ref),
                    )

                return {"ok": True, "ref": response.uri}
                if thread:
                    root_ref = models.create_strong_ref(response)
                    parent_ref = root_ref
                    for seg in thread:
                        seg = seg.strip()
                        if not seg:
                            continue
                        reply = await client.send_post(
                            text=seg,
                            reply_to=models.AppBskyFeedPost.ReplyRef(parent=parent_ref, root=root_ref),
                        )
                        parent_ref = models.create_strong_ref(reply)

                return {"ok": True, "ref": response.uri}

            except Exception as e:
                self._client = None
                return {"ok": False, "error": str(e)}

    async def _video_embed(self, client, media):
        did = client.me.did

        # The service-auth token's audience must be the account's PDS.
        # ⚠️ MOST LIKELY LINE TO NEED A TWEAK: if the video host returns an auth
        # error, adjust how pds_host is derived (or hardcode your PDS host).
        pds_host = httpx.URL(str(client._base_url)).host

        auth = await client.com.atproto.server.get_service_auth(
            models.ComAtprotoServerGetServiceAuth.Params(
                aud=f"did:web:{pds_host}",
                lxm="com.atproto.repo.uploadBlob",
                exp=int(time.time()) + 30 * 60,          # 30-min token
            )
        )

        # uploadVideo must go directly to the video service (no PDS proxy).
        async with httpx.AsyncClient(timeout=180) as http:
            up = await http.post(
                "https://video.bsky.app/xrpc/app.bsky.video.uploadVideo",
                params={"did": did, "name": f"{int(time.time() * 1000)}.mp4"},
                headers={
                    "Authorization": f"Bearer {auth.token}",
                    "Content-Type": media["content_type"] or "video/mp4",
                },
                content=media["bytes"],
            )
            up.raise_for_status()
            job_id = up.json().get("jobId")

        # Poll processing (this call CAN go through the PDS) until the blob is ready.
        blob = None
        for _ in range(60):                              # ~2 min ceiling
            await asyncio.sleep(2)
            status = await client.app.bsky.video.get_job_status(
                models.AppBskyVideoGetJobStatus.Params(job_id=job_id)
            )
            js = status.job_status
            if js.state == "JOB_STATE_FAILED":
                raise Exception(js.error or "video processing failed")
            if js.blob:
                blob = js.blob
                break
        if blob is None:
            raise Exception("video processing timed out")

        return models.AppBskyEmbedVideo.Main(video=blob, alt=media["alt"] or None)
    
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