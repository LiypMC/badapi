import os
import io
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import pandas as pd
from pymongo import MongoClient
from dotenv import load_dotenv
import boto3
from botocore.exceptions import ClientError
import aiohttp

# Import authentication dependency
from authbadapi import get_current_user
from rate_limiter import require_ai_limit, require_general_limit

# Load .env
load_dotenv()

# MongoDB setup
MONGO_URI = os.getenv("MONGO_URI")
client = MongoClient(MONGO_URI)
db = client["auth_db"]
uploads_collection = db["uploads"]
ai_summaries_collection = db["ai_summaries"]

# Cloudflare R2 setup
R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID")
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME")

# DeepSeek API setup
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"

if not DEEPSEEK_API_KEY:
    raise RuntimeError("DEEPSEEK_API_KEY not set in .env")

# Initialize R2 client
s3_client = boto3.client(
    's3',
    endpoint_url=f'https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com',
    aws_access_key_id=R2_ACCESS_KEY_ID,
    aws_secret_access_key=R2_SECRET_ACCESS_KEY,
    region_name='auto'
)

# Create router
router = APIRouter()


class AnalysisRequest(BaseModel):
    file_id: str


def create_analysis_package(df: pd.DataFrame) -> dict:
    
    #Create a compact analysis package from the DataFrame
    
    # Basic info
    analysis = {
        "row_count": len(df),
        "column_count": len(df.columns),
        "columns": {}
    }
    
    # Column details
    for col in df.columns:
        col_info = {
            "dtype": str(df[col].dtype),
            "missing_count": int(df[col].isna().sum()),
            "missing_percentage": round(float(df[col].isna().sum() / len(df) * 100), 2)
        }
        
        # Add statistics for numeric columns
        if pd.api.types.is_numeric_dtype(df[col]):
            col_info["statistics"] = {
                "mean": float(df[col].mean()) if not df[col].isna().all() else None,
                "median": float(df[col].median()) if not df[col].isna().all() else None,
                "std": float(df[col].std()) if not df[col].isna().all() else None,
                "min": float(df[col].min()) if not df[col].isna().all() else None,
                "max": float(df[col].max()) if not df[col].isna().all() else None
            }
        
        analysis["columns"][col] = col_info
    
    # Sample data (first 10 rows)
    analysis["sample_rows"] = df.head(10).to_dict(orient='records')
    
    return analysis


async def get_ai_summary(analysis_package: dict, filename: str) -> dict:
    
    #Send analysis package to DeepSeek API and get summary
    
    # Create detailed prompt
    prompt = f"""You are a data analyst. Analyze this CSV file and provide a comprehensive, insightful summary.

File: {filename}

Dataset Overview:
- Total Rows: {analysis_package['row_count']}
- Total Columns: {analysis_package['column_count']}

Column Details:
"""
    
    # Add column information
    for col_name, col_info in analysis_package['columns'].items():
        prompt += f"\n{col_name}:"
        prompt += f"\n  - Type: {col_info['dtype']}"
        prompt += f"\n  - Missing: {col_info['missing_count']} ({col_info['missing_percentage']}%)"
        
        if 'statistics' in col_info and col_info['statistics']['mean'] is not None:
            stats = col_info['statistics']
            prompt += f"\n  - Mean: {stats['mean']:.2f}"
            prompt += f"\n  - Median: {stats['median']:.2f}"
            prompt += f"\n  - Range: [{stats['min']:.2f}, {stats['max']:.2f}]"
    
    prompt += f"\n\nSample Data (first 10 rows):\n{analysis_package['sample_rows']}"
    
    prompt += """

Please provide:
1. A brief overview of what this dataset represents
2. Key insights about the data quality (missing values, data types)
3. Statistical highlights for numeric columns
4. Any patterns or notable observations
5. Recommendations for data analysis or cleaning

Keep the summary concise but informative."""
    
    # Call DeepSeek API
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                DEEPSEEK_API_URL,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {DEEPSEEK_API_KEY}"
                },
                json={
                    "model": "deepseek-chat",
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are InsightForge, a professional data analyst and business advisor. Your job is to turn raw dataset summaries into clear, actionable insights.\n\nYou write in a structured way, avoid fluff, and call out uncertainty when the data is limited. You highlight the most important patterns, anomalies, missing-data risks, and what decisions the data can support.\n\nYou do not invent facts or numbers that are not provided. If you need more information, you ask for it."
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    "temperature": 0.7,
                    "max_tokens": 2000
                }
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise HTTPException(
                        status_code=500,
                        detail=f"DeepSeek API error: {error_text}"
                    )
                
                result = await response.json()
                summary_text = result['choices'][0]['message']['content']
                
                return {
                    "model": "deepseek-chat",
                    "summary_text": summary_text,
                    "tokens_used": result.get('usage', {})
                }
                
    except aiohttp.ClientError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to call DeepSeek API: {str(e)}"
        )


@router.post("/analysis/ai-summary")
async def create_ai_summary(
    request: AnalysisRequest,
    user: dict = Depends(get_current_user),
    _ai_limit: None = Depends(require_ai_limit)
):
   
    #Generate AI summary for an uploaded CSV file
    
    #Headers required:
        #Authorization: Bearer <your_api_key>
    
    from bson import ObjectId
    
    try:
        #Verify API key → get user (done by Depends)
        
        #Verify the file_id belongs to that user
        try:
            upload = uploads_collection.find_one({
                "_id": ObjectId(request.file_id),
                "user_id": str(user["_id"])
            })
        except Exception:
            raise HTTPException(
                status_code=400,
                detail="Invalid file_id format"
            )
        
        if not upload:
            raise HTTPException(
                status_code=404,
                detail="Upload not found or does not belong to you"
            )
        
        # Check if summary already exists
        existing_summary = ai_summaries_collection.find_one({
            "file_id": request.file_id,
            "user_id": str(user["_id"])
        })
        
        if existing_summary:
            return {
                "file_id": request.file_id,
                "summary": existing_summary["summary_text"],
                "model": existing_summary["model"],
                "created_at": existing_summary["created_at"],
                "cached": True
            }
        
        # Download CSV from R2 (stream)
        try:
            response = s3_client.get_object(
                Bucket=R2_BUCKET_NAME,
                Key=upload["r2_key"]
            )
            file_content = response['Body'].read()
        except ClientError as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to download file from R2: {str(e)}"
            )
        
        # Load into pandas
        try:
            df = pd.read_csv(io.BytesIO(file_content))
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to parse CSV: {str(e)}"
            )
        
        # Create analysis package
        analysis_package = create_analysis_package(df)
        
        # Send to DeepSeek API
        ai_result = await get_ai_summary(analysis_package, upload["filename"])
        
        # Save result in MongoDB
        summary_doc = {
            "user_id": str(user["_id"]),
            "username": user["username"],
            "file_id": request.file_id,
            "filename": upload["filename"],
            "model": ai_result["model"],
            "summary_text": ai_result["summary_text"],
            "tokens_used": ai_result.get("tokens_used"),
            "created_at": datetime.utcnow()
        }
        
        result = ai_summaries_collection.insert_one(summary_doc)
        
        # Return the summary
        return {
            "file_id": request.file_id,
            "summary_id": str(result.inserted_id),
            "summary": ai_result["summary_text"],
            "model": ai_result["model"],
            "tokens_used": ai_result.get("tokens_used"),
            "created_at": summary_doc["created_at"],
            "cached": False
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error creating AI summary: {str(e)}"
        )


@router.get("/analysis/summaries")
def list_summaries(
    user: dict = Depends(get_current_user),
    _general_limit: None = Depends(require_general_limit)
):
    
    #List all AI summaries for the authenticated user
    
    summaries = ai_summaries_collection.find(
        {"user_id": str(user["_id"])}
    ).sort("created_at", -1)
    
    summaries_list = []
    for summary in summaries:
        summaries_list.append({
            "summary_id": str(summary["_id"]),
            "file_id": summary["file_id"],
            "filename": summary["filename"],
            "model": summary["model"],
            "created_at": summary["created_at"],
            "tokens_used": summary.get("tokens_used")
        })
    
    return {
        "summaries": summaries_list,
        "total": len(summaries_list)
    }


@router.get("/analysis/summary/{summary_id}")
def get_summary(
    summary_id: str,
    user: dict = Depends(get_current_user),
    _general_limit: None = Depends(require_general_limit)
):
    
    #Get a specific AI summary
    
    from bson import ObjectId
    
    try:
        summary = ai_summaries_collection.find_one({
            "_id": ObjectId(summary_id),
            "user_id": str(user["_id"])
        })
        
        if not summary:
            raise HTTPException(
                status_code=404,
                detail="Summary not found"
            )
        
        return {
            "summary_id": str(summary["_id"]),
            "file_id": summary["file_id"],
            "filename": summary["filename"],
            "model": summary["model"],
            "summary": summary["summary_text"],
            "tokens_used": summary.get("tokens_used"),
            "created_at": summary["created_at"]
        }
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid summary ID: {str(e)}"
        )
