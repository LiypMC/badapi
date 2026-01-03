import os
import bcrypt
import secrets
import hmac
import hashlib
import base64
import json
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Header, Depends, Request, Response
from pydantic import BaseModel
from pymongo import MongoClient
from dotenv import load_dotenv

# Load .env
load_dotenv()

# MongoDB
MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI:
    raise RuntimeError("MONGO_URI not set in .env")

client = MongoClient(MONGO_URI)
db = client["auth_db"]
users = db["users"]
api_keys = db["api_keys"]
sessions = db["sessions"]

API_KEY_SECRET = os.getenv("API_KEY_SECRET")
SESSION_TOKEN_SECRET = os.getenv("SESSION_TOKEN_SECRET")
SESSION_TTL_SECONDS = int(os.getenv("SESSION_TTL_SECONDS", "86400"))
JWT_SECRET = os.getenv("JWT_SECRET") or SESSION_TOKEN_SECRET
JWT_TTL_SECONDS = int(os.getenv("JWT_TTL_SECONDS", "3600"))

if not API_KEY_SECRET:
    raise RuntimeError("API_KEY_SECRET not set in .env")
if not SESSION_TOKEN_SECRET:
    raise RuntimeError("SESSION_TOKEN_SECRET not set in .env")

api_keys.create_index("key_hash", unique=True)
sessions.create_index("expires_at", expireAfterSeconds=0)

# Create router instead of app
router = APIRouter()

# Models
class UserAuth(BaseModel):
    username: str
    password: str

class ApiKeyRequest(BaseModel):
    username: str
    password: str
    replace: bool = False

# Register
@router.post("/user/register")
def register(user: UserAuth):
    if users.find_one({"username": user.username}):
        raise HTTPException(status_code=400, detail="User already exists")

    hashed_pw = bcrypt.hashpw(user.password.encode(), bcrypt.gensalt())

    users.insert_one({
        "username": user.username,
        "password": hashed_pw,
        "api_key": None,
        "created_at": datetime.utcnow()
    })

    return {
        "message": "User registered successfully. Please log in."
    }

# Login
@router.post("/user/login")
def login(user: UserAuth):
    db_user = users.find_one({"username": user.username})

    if not db_user or not bcrypt.checkpw(
        user.password.encode(),
        db_user["password"]
    ):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    session_token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(seconds=SESSION_TTL_SECONDS)
    sessions.insert_one({
        "user_id": str(db_user["_id"]),
        "token_hash": _hash_session_token(session_token),
        "created_at": datetime.utcnow(),
        "expires_at": expires_at,
        "last_used_at": None
    })

    jwt_token, jwt_expires_at = _create_jwt_token(str(db_user["_id"]), db_user["username"])

    return {
        "message": "Login successful. Use apikey/create to get an API key.",
        "session_token": session_token,
        "session_expires_at": expires_at,
        "jwt": jwt_token,
        "jwt_expires_at": jwt_expires_at
    }

# Create / Rotate API Key
@router.post("/apikey/create")
def create_api_key(data: ApiKeyRequest):
    db_user = users.find_one({"username": data.username})

    if not db_user or not bcrypt.checkpw(
        data.password.encode(),
        db_user["password"]
    ):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if db_user.get("api_key") and not data.replace:
        return {
            "api_key": db_user["api_key"],
            "message": "Existing API key returned"
        }

    new_api_key = secrets.token_hex(32)

    users.update_one(
        {"_id": db_user["_id"]},
        {"$set": {"api_key": new_api_key}}
    )

    return {
        "api_key": new_api_key,
        "message": "New API key created"
    }

def _hash_token(secret: str, token: str) -> str:
    return hmac.new(
        secret.encode("utf-8"),
        token.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()

def hash_api_key(api_key: str) -> str:
    return _hash_token(API_KEY_SECRET, api_key)

def _hash_session_token(token: str) -> str:
    return _hash_token(SESSION_TOKEN_SECRET, token)

def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")

def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)

def _create_jwt_token(user_id: str, username: str):
    now = datetime.utcnow()
    exp = now + timedelta(seconds=JWT_TTL_SECONDS)

    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": user_id,
        "username": username,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp())
    }

    header_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    signature = hmac.new(JWT_SECRET.encode("utf-8"), signing_input, hashlib.sha256).digest()
    sig_b64 = _b64url_encode(signature)
    token = f"{header_b64}.{payload_b64}.{sig_b64}"
    return token, exp

def _verify_jwt_token(token: str) -> dict:
    parts = token.split(".")
    if len(parts) != 3:
        raise HTTPException(status_code=401, detail="Invalid JWT format")

    header_b64, payload_b64, sig_b64 = parts
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    expected_sig = hmac.new(JWT_SECRET.encode("utf-8"), signing_input, hashlib.sha256).digest()
    if not hmac.compare_digest(_b64url_encode(expected_sig), sig_b64):
        raise HTTPException(status_code=401, detail="Invalid JWT signature")

    try:
        payload = json.loads(_b64url_decode(payload_b64))
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid JWT payload")

    exp = payload.get("exp")
    if not exp or datetime.utcnow().timestamp() > exp:
        raise HTTPException(status_code=401, detail="JWT expired")

    return payload

def _get_user_by_id(user_id_value):
    try:
        from bson import ObjectId
        return users.find_one({"_id": ObjectId(user_id_value)})
    except Exception:
        return users.find_one({"_id": user_id_value})

# API Key Auth Dependency
def get_current_user(request: Request, authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing API key")

    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization format")

    api_key = authorization.replace("Bearer ", "")

    key_doc = api_keys.find_one({
        "key_hash": hash_api_key(api_key),
        "$or": [
            {"revoked_at": None},
            {"revoked_at": {"$exists": False}}
        ]
    })

    if key_doc:
        api_keys.update_one(
            {"_id": key_doc["_id"]},
            {"$set": {"last_used_at": datetime.utcnow()}}
        )
        user = _get_user_by_id(key_doc["user_id"])
        if user:
            request.state.auth = {
                "user_id": str(user["_id"]),
                "api_key_id": str(key_doc["_id"])
            }
            return user

    user = users.find_one({"api_key": api_key})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid API key")

    request.state.auth = {
        "user_id": str(user["_id"]),
        "api_key_id": hash_api_key(api_key)
    }

    return user

# Session Auth Dependency (for API key management)
def get_current_session_user(request: Request, authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing session token")

    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization format")

    session_token = authorization.replace("Bearer ", "")
    token_hash = _hash_session_token(session_token)
    session_doc = sessions.find_one({"token_hash": token_hash})

    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session token")

    if session_doc.get("expires_at") and session_doc["expires_at"] < datetime.utcnow():
        raise HTTPException(status_code=401, detail="Session expired")

    sessions.update_one(
        {"_id": session_doc["_id"]},
        {"$set": {"last_used_at": datetime.utcnow()}}
    )

    user = _get_user_by_id(session_doc["user_id"])
    if not user:
        raise HTTPException(status_code=401, detail="Invalid session token")

    request.state.auth = {
        "user_id": str(user["_id"]),
        "api_key_id": None
    }

    return user

def get_current_jwt_user(request: Request, authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing JWT")

    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization format")

    token = authorization.replace("Bearer ", "")
    payload = _verify_jwt_token(token)

    user = _get_user_by_id(payload.get("sub"))
    if not user:
        raise HTTPException(status_code=401, detail="Invalid JWT")

    request.state.auth = {
        "user_id": str(user["_id"]),
        "api_key_id": None
    }

    return user

# Protected Route
@router.get("/protected")
def protected(
    request: Request,
    response: Response,
    user=Depends(get_current_user)
):
    from rate_limiter import require_general_limit
    require_general_limit(request, response, user)
    return {
        "message": f"Hello {user['username']}, you have access."
    }
