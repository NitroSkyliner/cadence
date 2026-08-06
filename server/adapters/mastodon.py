import httpx

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
            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.post(
                    f"{self._base}/api/v1/statuses",
                    headers={**self._headers(), "Idempotency-Key": post["id"]},
                    data={"status": post["text"]},
                )
                r.raise_for_status()
                return {"ok": True, "ref": str(r.json()["id"])}
        except Exception as e:
            return {"ok": False, "error": str(e)}

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