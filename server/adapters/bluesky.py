from atproto import AsyncClient

from .base import Adapter


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
            response = await client.send_post(text=post["text"])
            return {"ok": True, "ref": response.uri}    # AT-URI of the real post
        except Exception as e:
            self._client = None                         # force re-login next time
            return {"ok": False, "error": str(e)}