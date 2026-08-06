from typing import Optional
from pydantic import BaseModel, Field


class PublishResult(BaseModel):
    ok: bool
    ref: Optional[str] = None
    error: Optional[str] = None


class PlatformMetrics(BaseModel):
    likes: int = 0
    reposts: int = 0
    replies: int = 0


class Post(BaseModel):
    id: str
    text: str
    platforms: list[str]
    scheduledAt: str
    status: str
    results: dict[str, PublishResult] = Field(default_factory=dict)
    metrics: dict[str, PlatformMetrics] = Field(default_factory=dict)
    createdAt: int


class PostPatch(BaseModel):
    status: Optional[str] = None
    results: Optional[dict[str, PublishResult]] = None
    metrics: Optional[dict[str, PlatformMetrics]] = None