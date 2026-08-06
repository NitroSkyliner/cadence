class Adapter:
    def __init__(self, platform_id: str):
        self.platform_id = platform_id

    async def publish(self, post: dict) -> dict:
        raise NotImplementedError(f"{self.platform_id}: publish() not implemented")

    async def fetch_metrics(self, ref: str) -> dict:
        raise NotImplementedError(f"{self.platform_id}: fetch_metrics() not implemented")

    async def verify(self) -> str | None:
        """Log in / validate credentials. Return a display handle if known. Default: OK."""
        return None