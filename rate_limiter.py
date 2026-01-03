import os
import time
from datetime import datetime, timezone
from typing import Dict, List, Tuple

from fastapi import Depends, HTTPException, Request, Response
from pymongo import MongoClient, ReturnDocument

from authbadapi import get_current_user
# MongoDB
MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI:
    raise RuntimeError("MONGO_URI not set in .env")

client = MongoClient(MONGO_URI)
db = client["auth_db"]
rate_limits = db["rate_limits"]

rate_limits.create_index(
    [("key", 1), ("bucket", 1), ("window_seconds", 1), ("window_start", 1)],
    unique=True
)


def _window_start(now_ts: int, window_seconds: int) -> int:
    return (now_ts // window_seconds) * window_seconds


def _rate_limit_headers(bucket: str, name: str, limit: int, remaining: int, reset_at: int) -> Dict[str, str]:
    return {
        f"X-RateLimit-Limit-{bucket}-{name}": str(limit),
        f"X-RateLimit-Remaining-{bucket}-{name}": str(remaining),
        f"X-RateLimit-Reset-{bucket}-{name}": str(reset_at)
    }


def _apply_limits(key: str, bucket: str, limits: List[Dict[str, object]]) -> Tuple[Dict[str, str], int]:
    now_ts = int(time.time())
    headers: Dict[str, str] = {}
    retry_after = 0

    for limit in limits:
        window_seconds = limit["window_seconds"]
        window_name = limit["name"]
        max_requests = limit["limit"]
        window_start = _window_start(now_ts, window_seconds)
        reset_at = window_start + window_seconds

        doc = rate_limits.find_one_and_update(
            {
                "key": key,
                "bucket": bucket,
                "window_seconds": window_seconds,
                "window_start": window_start
            },
            {
                "$inc": {"count": 1},
                "$setOnInsert": {"reset_at": datetime.fromtimestamp(reset_at, tz=timezone.utc)}
            },
            upsert=True,
            return_document=ReturnDocument.AFTER
        )

        count = doc["count"]
        remaining = max(max_requests - count, 0)
        headers.update(_rate_limit_headers(bucket, window_name, max_requests, remaining, reset_at))

        if count > max_requests:
            retry_after = max(retry_after, reset_at - now_ts)

    return headers, retry_after


def _auth_key_for_user(request: Request, user: dict) -> str:
    auth = getattr(request.state, "auth", None) or {}
    api_key_id = auth.get("api_key_id")
    if api_key_id:
        return f"key:{api_key_id}"
    return f"user:{user['_id']}"


def _enforce(response: Response, key: str, bucket: str, limits: List[Dict[str, object]]):
    headers, retry_after = _apply_limits(key, bucket, limits)
    response.headers.update(headers)
    if retry_after > 0:
        headers["Retry-After"] = str(retry_after)
        raise HTTPException(status_code=429, detail="Rate limit exceeded", headers=headers)


def require_general_limit(
    request: Request,
    response: Response,
    user: dict = Depends(get_current_user)
):
    limits = [
        {"name": "second", "limit": 10, "window_seconds": 1},
        {"name": "minute", "limit": 60, "window_seconds": 60},
        {"name": "day", "limit": 5000, "window_seconds": 86400}
    ]
    key = _auth_key_for_user(request, user)
    _enforce(response, key, "general", limits)


def require_ai_limit(
    request: Request,
    response: Response,
    user: dict = Depends(get_current_user)
):
    limits = [
        {"name": "minute", "limit": 1, "window_seconds": 60},
        {"name": "day", "limit": 5, "window_seconds": 86400}
    ]
    key = _auth_key_for_user(request, user)
    _enforce(response, key, "ai", limits)


def require_upload_limit(
    request: Request,
    response: Response,
    user: dict = Depends(get_current_user)
):
    limits = [
        {"name": "day", "limit": 20, "window_seconds": 86400}
    ]
    key = _auth_key_for_user(request, user)
    _enforce(response, key, "upload", limits)


def require_download_link_limit(
    request: Request,
    response: Response,
    user: dict = Depends(get_current_user)
):
    limits = [
        {"name": "hour", "limit": 120, "window_seconds": 3600}
    ]
    key = _auth_key_for_user(request, user)
    _enforce(response, key, "download_link", limits)


def enforce_download_token_general_limit(response: Response, user_id: str):
    limits = [
        {"name": "second", "limit": 10, "window_seconds": 1},
        {"name": "minute", "limit": 60, "window_seconds": 60},
        {"name": "day", "limit": 5000, "window_seconds": 86400}
    ]
    key = f"user:{user_id}"
    _enforce(response, key, "general", limits)
