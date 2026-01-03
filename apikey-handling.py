import os
import secrets
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from pymongo import MongoClient

from authbadapi import get_current_session_user, hash_api_key

# MongoDB
MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI:
    raise RuntimeError("MONGO_URI not set in .env")

client = MongoClient(MONGO_URI)
db = client["auth_db"]
api_keys = db["api_keys"]

# Create router
router = APIRouter()


class ApiKeyCreateRequest(BaseModel):
    name: Optional[str] = None


@router.post("/auth/apikeys")
def create_api_key(
    data: ApiKeyCreateRequest,
    user: dict = Depends(get_current_session_user)
):
    raw_key = secrets.token_urlsafe(32)
    last4 = raw_key[-4:]

    doc = {
        "user_id": str(user["_id"]),
        "name": data.name,
        "key_hash": hash_api_key(raw_key),
        "last4": last4,
        "created_at": datetime.utcnow(),
        "last_used_at": None,
        "revoked_at": None
    }

    result = api_keys.insert_one(doc)

    return {
        "key_id": str(result.inserted_id),
        "name": data.name,
        "last4": last4,
        "created_at": doc["created_at"],
        "api_key": raw_key
    }


@router.get("/auth/apikeys")
def list_api_keys(user: dict = Depends(get_current_session_user)):
    keys = api_keys.find({"user_id": str(user["_id"])}).sort("created_at", -1)

    items = []
    for key in keys:
        items.append({
            "key_id": str(key["_id"]),
            "name": key.get("name"),
            "last4": key.get("last4"),
            "created_at": key.get("created_at"),
            "last_used_at": key.get("last_used_at"),
            "revoked_at": key.get("revoked_at")
        })

    return {"keys": items, "total": len(items)}


@router.delete("/auth/apikeys/{key_id}")
def revoke_api_key(
    key_id: str,
    user: dict = Depends(get_current_session_user)
):
    from bson import ObjectId

    try:
        key = api_keys.find_one({
            "_id": ObjectId(key_id),
            "user_id": str(user["_id"])
        })
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid key_id format")

    if not key:
        raise HTTPException(status_code=404, detail="Key not found")

    if key.get("revoked_at"):
        return {"message": "Key already revoked", "key_id": key_id}

    api_keys.update_one(
        {"_id": key["_id"]},
        {"$set": {"revoked_at": datetime.utcnow()}}
    )

    return {"message": "Key revoked", "key_id": key_id}
