import os
import hashlib
import io
import uuid
import hmac
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, File, UploadFile, HTTPException, Depends, Request, Response
import pandas as pd
from pymongo import MongoClient
from dotenv import load_dotenv
import boto3
from botocore.exceptions import ClientError

# Import the authentication dependency from main file
from authbadapi import get_current_user
from rate_limiter import (
    require_general_limit,
    require_upload_limit,
    require_download_link_limit,
    enforce_download_token_general_limit
)

# Load .env
load_dotenv()

# MongoDB setup
MONGO_URI = os.getenv("MONGO_URI")
client = MongoClient(MONGO_URI)
db = client["auth_db"]
uploads_collection = db["uploads"]
download_tokens_collection = db["download_tokens"]

# Cloudflare R2 setup
R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID")
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME")
DOWNLOAD_TOKEN_SECRET = os.getenv("DOWNLOAD_TOKEN_SECRET")
DOWNLOAD_TOKEN_TTL_SECONDS = int(os.getenv("DOWNLOAD_TOKEN_TTL_SECONDS", "60"))
R2_PRESIGN_TTL_SECONDS = int(os.getenv("R2_PRESIGN_TTL_SECONDS", "60"))
DOWNLOAD_BIND_IP = os.getenv("DOWNLOAD_BIND_IP", "false").lower() in {"1", "true", "yes"}
DOWNLOAD_BIND_UA = os.getenv("DOWNLOAD_BIND_UA", "false").lower() in {"1", "true", "yes"}
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "").rstrip("/")
MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE_MB", "200"))
MAX_ROWS = int(os.getenv("MAX_ROWS", "200000"))
MAX_COLUMNS = int(os.getenv("MAX_COLUMNS", "200"))

if not all([R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME]):
    raise RuntimeError("R2 credentials not set in .env - Check R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME")
if not DOWNLOAD_TOKEN_SECRET:
    raise RuntimeError("DOWNLOAD_TOKEN_SECRET not set in .env")

# Initialize R2 client (S3-compatible API)
s3_client = boto3.client(
    's3',
    endpoint_url=f'https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com',
    aws_access_key_id=R2_ACCESS_KEY_ID,
    aws_secret_access_key=R2_SECRET_ACCESS_KEY,
    region_name='auto'
)

# Create router
router = APIRouter()

# TTL index for auto-cleanup of expired tokens
download_tokens_collection.create_index("expires_at", expireAfterSeconds=0)


def hash_file_content(content: bytes) -> str:
    #Generate SHA-256 hash of file content
    return hashlib.sha256(content).hexdigest()


def _client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else ""


def _token_hash(token: str) -> str:
    # HMAC the token so the DB never stores raw secrets
    return hmac.new(
        DOWNLOAD_TOKEN_SECRET.encode("utf-8"),
        token.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()


def _build_public_url(path: str) -> str:
    if PUBLIC_BASE_URL:
        return f"{PUBLIC_BASE_URL}{path}"
    return path


def _create_download_token(user_id: str, r2_key: str, request: Request) -> dict:
    token = secrets.token_urlsafe(32)
    token_hash = _token_hash(token)
    expires_at = datetime.utcnow() + timedelta(seconds=DOWNLOAD_TOKEN_TTL_SECONDS)
    client_ip = _client_ip(request)
    user_agent = request.headers.get("user-agent", "")

    download_tokens_collection.insert_one({
        "token_hash": token_hash,
        "user_id": user_id,
        "r2_key": r2_key,
        "expires_at": expires_at,
        "used": False,
        "created_at": datetime.utcnow(),
        "bind_ip": client_ip if DOWNLOAD_BIND_IP else None,
        "bind_ua": user_agent if DOWNLOAD_BIND_UA else None
    })

    return {
        "token": token,
        "expires_at": expires_at
    }


def _generate_presigned_url(r2_key: str) -> str:
    return s3_client.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": R2_BUCKET_NAME,
            "Key": r2_key
        },
        ExpiresIn=R2_PRESIGN_TTL_SECONDS,
        HttpMethod="GET"
    )


@router.post("/data/upload")
async def upload_csv(
    request: Request,
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
    _general_limit: None = Depends(require_general_limit),
    _upload_limit: None = Depends(require_upload_limit)
):
    
    #Upload a CSV file with API key authentication
    
    #Headers required:
        #Authorization: Bearer <your_api_key>
    
    
    # Validate file type
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=400,
            detail="File must be a CSV"
        )
    
    try:
        # Read file content ONCE into memory
        contents = await file.read()
        
        # Generate file hash
        file_hash = hash_file_content(contents)
        file_size = len(contents)

        if file_size > MAX_FILE_SIZE_MB * 1024 * 1024:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Max size is {MAX_FILE_SIZE_MB} MB"
            )
        
        # Check if this exact file was already uploaded by this user
        existing_file = uploads_collection.find_one({
            "file_hash": file_hash,
            "user_id": str(user["_id"])
        })
        
        if existing_file:
            token_info = _create_download_token(str(user["_id"]), existing_file["r2_key"], request)
            return {
                "message": "File already uploaded",
                "file_id": str(existing_file["_id"]),
                "file_hash": file_hash,
                "r2_key": existing_file["r2_key"],
                "uploaded_at": existing_file["uploaded_at"],
                "download_token": token_info["token"],
                "download_token_expires_at": token_info["expires_at"],
                "download_link": _build_public_url(f"/data/download/{token_info['token']}")
            }
        
        # Parse CSV to validate it and extract metadata
        try:
            df = pd.read_csv(io.BytesIO(contents))
            row_count = len(df)
            column_count = len(df.columns)
            columns = [str(col).strip() for col in df.columns]  # Strip whitespace from headers
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid CSV file: {str(e)}"
            )

        if row_count > MAX_ROWS:
            raise HTTPException(
                status_code=400,
                detail=f"Too many rows. Max is {MAX_ROWS}"
            )

        if column_count > MAX_COLUMNS:
            raise HTTPException(
                status_code=400,
                detail=f"Too many columns. Max is {MAX_COLUMNS}"
            )
        
        # Generate R2 key: users/{user_id}/{uuid}.csv
        file_uuid = str(uuid.uuid4())
        r2_key = f"users/{user['_id']}/{file_uuid}.csv"
        
        # Upload to Cloudflare R2
        try:
            s3_client.put_object(
                Bucket=R2_BUCKET_NAME,
                Key=r2_key,
                Body=contents,
                ContentType='text/csv',
                Metadata={
                    'original_filename': file.filename,
                    'user_id': str(user["_id"]),
                    'file_hash': file_hash
                }
            )
        except ClientError as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to upload to R2: {str(e)}"
            )
        
        # Store metadata ONLY in MongoDB (no file_content)
        upload_doc = {
            "user_id": str(user["_id"]),
            "username": user["username"],
            "filename": file.filename,
            "r2_key": r2_key,
            "file_hash": file_hash,
            "file_size": file_size,
            "row_count": row_count,
            "column_count": column_count,
            "columns": columns,
            "uploaded_at": datetime.utcnow()
        }
        

        result = uploads_collection.insert_one(upload_doc)
        token_info = _create_download_token(str(user["_id"]), r2_key, request)
        
        return {
            "message": "File uploaded successfully to R2",
            "file_id": str(result.inserted_id),
            "file_hash": file_hash,
            "filename": file.filename,
            "r2_key": r2_key,
            "file_size": file_size,
            "row_count": row_count,
            "column_count": column_count,
            "columns": columns,
            "uploaded_at": upload_doc["uploaded_at"],
            "download_token": token_info["token"],
            "download_token_expires_at": token_info["expires_at"],
            "download_link": _build_public_url(f"/data/download/{token_info['token']}")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing file: {str(e)}"
        )


@router.get("/data/uploads")
def list_uploads(
    user: dict = Depends(get_current_user),
    _general_limit: None = Depends(require_general_limit)
):
    
    #List all CSV files uploaded by the authenticated user
    
    user_uploads = uploads_collection.find(
        {"user_id": str(user["_id"])}
    ).sort("uploaded_at", -1)
    
    uploads_list = []
    for upload in user_uploads:
        uploads_list.append({
            "file_id": str(upload["_id"]),
            "filename": upload["filename"],
            "r2_key": upload["r2_key"],
            "file_hash": upload["file_hash"],
            "file_size": upload["file_size"],
            "row_count": upload["row_count"],
            "column_count": upload["column_count"],
            "columns": upload["columns"],
            "uploaded_at": upload["uploaded_at"]
        })
    
    return {
        "uploads": uploads_list,
        "total": len(uploads_list)
    }


@router.get("/data/upload/{file_id}")
def get_upload_info(
    file_id: str,
    user: dict = Depends(get_current_user),
    _general_limit: None = Depends(require_general_limit)
):

    #Get details about a specific uploaded file
    
    from bson import ObjectId
    
    try:
        upload = uploads_collection.find_one({
            "_id": ObjectId(file_id),
            "user_id": str(user["_id"])
        })
        
        if not upload:
            raise HTTPException(
                status_code=404,
                detail="File not found"
            )
        
        return {
            "file_id": str(upload["_id"]),
            "filename": upload["filename"],
            "r2_key": upload["r2_key"],
            "file_hash": upload["file_hash"],
            "file_size": upload["file_size"],
            "row_count": upload["row_count"],
            "column_count": upload["column_count"],
            "columns": upload["columns"],
            "uploaded_at": upload["uploaded_at"]
        }
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file ID: {str(e)}"
        )


@router.post("/data/upload/{file_id}/link")
def create_download_link(
    file_id: str,
    request: Request,
    user: dict = Depends(get_current_user),
    _general_limit: None = Depends(require_general_limit),
    _download_link_limit: None = Depends(require_download_link_limit)
):

    #Create a short-lived one-time download token for a file

    from bson import ObjectId

    try:
        upload = uploads_collection.find_one({
            "_id": ObjectId(file_id),
            "user_id": str(user["_id"])
        })

        if not upload:
            raise HTTPException(
                status_code=404,
                detail="File not found"
            )

        token_info = _create_download_token(str(user["_id"]), upload["r2_key"], request)

        return {
            "file_id": str(upload["_id"]),
            "download_token": token_info["token"],
            "download_token_expires_at": token_info["expires_at"],
            "download_link": _build_public_url(f"/data/download/{token_info['token']}")
        }
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Error creating download link: {str(e)}"
        )


@router.get("/data/download/{token}")
def download_with_token(token: str, request: Request, response: Response):

    #Validate token and return a short-lived presigned URL

    token_hash = _token_hash(token)
    token_doc = download_tokens_collection.find_one({"token_hash": token_hash})

    if not token_doc:
        raise HTTPException(status_code=404, detail="Download token not found")

    now = datetime.utcnow()
    if token_doc.get("expires_at") and token_doc["expires_at"] < now:
        raise HTTPException(status_code=410, detail="Download token expired")

    if token_doc.get("used"):
        raise HTTPException(status_code=410, detail="Download token already used")

    if DOWNLOAD_BIND_IP and token_doc.get("bind_ip"):
        if token_doc["bind_ip"] != _client_ip(request):
            raise HTTPException(status_code=403, detail="Download token not valid for this IP")

    if DOWNLOAD_BIND_UA and token_doc.get("bind_ua"):
        if token_doc["bind_ua"] != request.headers.get("user-agent", ""):
            raise HTTPException(status_code=403, detail="Download token not valid for this device")

    enforce_download_token_general_limit(response, token_doc["user_id"])

    updated = download_tokens_collection.update_one(
        {"_id": token_doc["_id"], "used": False},
        {"$set": {"used": True, "used_at": now, "used_ip": _client_ip(request)}}
    )

    if updated.modified_count == 0:
        raise HTTPException(status_code=410, detail="Download token already used")

    try:
        presigned_url = _generate_presigned_url(token_doc["r2_key"])
    except ClientError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create download URL: {str(e)}"
        )

    return {
        "download_url": presigned_url,
        "expires_in": R2_PRESIGN_TTL_SECONDS
    }


@router.delete("/data/upload/{file_id}")
def delete_upload(
    file_id: str,
    user: dict = Depends(get_current_user),
    _general_limit: None = Depends(require_general_limit)
):
    
    #Delete an uploaded file from both R2 and MongoDB

    from bson import ObjectId
    
    try:
        upload = uploads_collection.find_one({
            "_id": ObjectId(file_id),
            "user_id": str(user["_id"])
        })
        
        if not upload:
            raise HTTPException(
                status_code=404,
                detail="File not found"
            )
        
        # Delete from R2
        try:
            s3_client.delete_object(
                Bucket=R2_BUCKET_NAME,
                Key=upload["r2_key"]
            )
        except ClientError as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to delete from R2: {str(e)}"
            )
        
        # Delete metadata from MongoDB
        uploads_collection.delete_one({"_id": ObjectId(file_id)})
        download_tokens_collection.delete_many({"r2_key": upload["r2_key"]})
        
        return {
            "message": "File deleted successfully from R2 and MongoDB",
            "file_id": file_id,
            "r2_key": upload["r2_key"]
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Error deleting file: {str(e)}"
        )
