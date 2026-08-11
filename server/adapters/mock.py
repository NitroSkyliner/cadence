import asyncio
import random
import time

from .base import Adapter


class MockAdapter(Adapter):
    async def publish(self, post: dict) -> dict:
        await asyncio.sleep(0.6)                      # pretend network latency
        if random.random() < 0.1:                     # 10% failure
            return {"ok": False, "error": "Mock network error"}
        return {"ok": True, "ref": f"mock_{self.platform_id}_{int(time.time() * 1000)}"}

    async def fetch_metrics(self, ref: str) -> dict:
            await asyncio.sleep(0.4)
            n = lambda: random.randint(0, 500)
            return {"likes": n(), "reposts": n(), "replies": n()}

    async def fetch_followers(self) -> int | None:
        import random
        return 1000 + random.randint(-20, 40)

    async def fetch_inbox(self) -> list[dict]:
        now = int(time.time() * 1000)
        return [
            {"id": f"mock-{self.platform_id}-1", "author": "someone", "author_name": "Someone",
             "text": "Love this — when's the next one?", "reason": "reply",
             "created_at": now - 3_600_000, "reply_ctx": {"mock": True}},
            {"id": f"mock-{self.platform_id}-2", "author": "afan", "author_name": "A Fan",
             "text": f"@you great post on {self.platform_id}!", "reason": "mention",
             "created_at": now - 7_200_000, "reply_ctx": {"mock": True}},
        ]

    async def reply(self, ctx: dict, text: str) -> dict:
        await asyncio.sleep(0.3)
        return {"ok": True}