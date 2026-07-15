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
        return {"likes": n(), "reposts": n(), "replies": n(), "views": n() * 10}