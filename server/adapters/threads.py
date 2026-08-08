import httpx

from .base import Adapter

BASE = "https://graph.threads.net/v1.0"


class ThreadsAdapter(Adapter):
    def __init__(self, conn_id: str):
        super().__init__("threads")
        self._conn_id = conn_id
        self._user_id = None

    async def _token(self) -> str:
        from oauth import valid_access_token
        tok = await valid_access_token(self._conn_id)
        if not tok:
            raise Exception("Threads account not connected")
        return tok

    async def _resolve_uid(self, http, token) -> str:
        if self._user_id:
            return self._user_id
        r = await http.get(f"{BASE}/me", params={"fields": "id,username", "access_token": token})
        r.raise_for_status()
        self._user_id = r.json()["id"]
        return self._user_id

    async def publish(self, post: dict) -> dict:
        try:
            token = await self._token()
            async with httpx.AsyncClient(timeout=60) as http:
                uid = await self._resolve_uid(http, token)

                # Threads fetches media from a PUBLIC url — needs the hosting/deploy step.
                # Text posts work without it; media posting lights up once Cadence is hosted.
                if post.get("media"):
                    return {"ok": False,
                            "error": "Threads media needs public hosting (deploy step); text posts work now"}

                container = await http.post(
                    f"{BASE}/{uid}/threads",
                    params={"media_type": "TEXT", "text": post["text"], "access_token": token},
                )
                container.raise_for_status()
                creation_id = container.json()["id"]

                published = await http.post(
                    f"{BASE}/{uid}/threads_publish",
                    params={"creation_id": creation_id, "access_token": token},
                )
                published.raise_for_status()
                return {"ok": True, "ref": published.json()["id"]}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    async def fetch_metrics(self, ref: str) -> dict:
        token = await self._token()
        async with httpx.AsyncClient(timeout=30) as http:
            r = await http.get(
                f"{BASE}/{ref}/insights",
                params={"metric": "likes,replies,reposts,quotes", "access_token": token},
            )
            r.raise_for_status()
            vals = {}
            for item in r.json().get("data", []):
                v = item.get("total_value", {}).get("value")
                if v is None:                       # some metrics come as a values[] series
                    v = (item.get("values") or [{}])[0].get("value", 0)
                vals[item.get("name")] = v or 0
            return {
                "likes":   vals.get("likes", 0),
                "reposts": vals.get("reposts", 0) + vals.get("quotes", 0),
                "replies": vals.get("replies", 0),
            }

    async def verify(self) -> str | None:
        token = await self._token()
        async with httpx.AsyncClient(timeout=30) as http:
            r = await http.get(f"{BASE}/me", params={"fields": "username", "access_token": token})
            r.raise_for_status()
            return "@" + r.json().get("username", "threads")