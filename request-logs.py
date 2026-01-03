import os
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from pymongo import MongoClient

from authbadapi import get_current_jwt_user

# MongoDB
MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI:
    raise RuntimeError("MONGO_URI not set in .env")

client = MongoClient(MONGO_URI)
db = client["auth_db"]
request_logs = db["request_logs"]

# Create router
router = APIRouter()


class RequestLog(BaseModel):
    timestamp: datetime
    user_id: str
    api_key_id: Optional[str]
    method: str
    path: str
    status_code: int
    latency_ms: int
    upload_id: Optional[str]
    ip: Optional[str]
    user_agent: Optional[str]


def _client_ip(request: Request) -> Optional[str]:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None


def log_request(auth: dict, request: Request, status_code: int, latency_ms: int, upload_id: Optional[str]):
    if not auth:
        return

    doc = {
        "timestamp": datetime.utcnow(),
        "user_id": auth.get("user_id"),
        "api_key_id": auth.get("api_key_id"),
        "method": request.method,
        "path": request.url.path,
        "status_code": status_code,
        "latency_ms": latency_ms,
        "upload_id": upload_id,
        "ip": _client_ip(request),
        "user_agent": request.headers.get("user-agent")
    }

    request_logs.insert_one(doc)


@router.get("/admin/me/logs")
def list_my_logs(
    limit: int = 50,
    user: dict = Depends(get_current_jwt_user)
):
    if limit < 1 or limit > 200:
        raise HTTPException(status_code=400, detail="Limit must be between 1 and 200")

    logs = request_logs.find(
        {"user_id": str(user["_id"])}
    ).sort("timestamp", -1).limit(limit)

    items = []
    for log in logs:
        items.append({
            "timestamp": log.get("timestamp"),
            "user_id": log.get("user_id"),
            "api_key_id": log.get("api_key_id"),
            "method": log.get("method"),
            "path": log.get("path"),
            "status_code": log.get("status_code"),
            "latency_ms": log.get("latency_ms"),
            "upload_id": log.get("upload_id"),
            "ip": log.get("ip"),
            "user_agent": log.get("user_agent")
        })

    return {"logs": items, "total": len(items)}
