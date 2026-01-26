import os
import importlib.util
import time
import json
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from authbadapi import router as auth_router
from upload import router as upload_router
from analysis import router as analysis_router  # ← ADD THIS

def _load_apikey_router():
    module_path = os.path.join(os.path.dirname(__file__), "apikey-handling.py")
    spec = importlib.util.spec_from_file_location("apikey_handling", module_path)
    if not spec or not spec.loader:
        raise RuntimeError("Failed to load apikey-handling.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.router

def _load_request_logs_module():
    module_path = os.path.join(os.path.dirname(__file__), "request-logs.py")
    spec = importlib.util.spec_from_file_location("request_logs", module_path)
    if not spec or not spec.loader:
        raise RuntimeError("Failed to load request-logs.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

apikey_router = _load_apikey_router()
request_logs_module = _load_request_logs_module()
request_logs_router = request_logs_module.router

app = FastAPI(title="BadAPI 😈")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://badapis.axionslab.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

@app.middleware("http")
async def log_authenticated_requests(request: Request, call_next):
    upload_id = None
    if "upload_id" in request.path_params:
        upload_id = request.path_params.get("upload_id")
    elif "file_id" in request.path_params:
        upload_id = request.path_params.get("file_id")

    if not upload_id:
        if "upload_id" in request.query_params:
            upload_id = request.query_params.get("upload_id")
        elif "file_id" in request.query_params:
            upload_id = request.query_params.get("file_id")

    if not upload_id:
        content_type = request.headers.get("content-type", "")
        if content_type.startswith("application/json"):
            try:
                body = await request.body()
                if body:
                    payload = json.loads(body)
                    if isinstance(payload, dict):
                        upload_id = payload.get("upload_id") or payload.get("file_id")
            except Exception:
                pass

    start = time.perf_counter()
    response = await call_next(request)
    latency_ms = int((time.perf_counter() - start) * 1000)

    auth = getattr(request.state, "auth", None)
    if auth:
        request_logs_module.log_request(auth, request, response.status_code, latency_ms, upload_id)

    return response

# Include routers
app.include_router(auth_router, tags=["Authentication"])
app.include_router(upload_router, tags=["Data Upload"])
app.include_router(analysis_router, tags=["AI Analysis"])  # ← ADD THIS
app.include_router(apikey_router, tags=["API Keys"])
app.include_router(request_logs_router, tags=["Request Logs"])

@app.get("/", tags=["Root"])
def root():
    return {
        "message": "Welcome to BadAPI 😈",
        "endpoints": {
            "auth": {
                "register": "POST /user/register",
                "login": "POST /user/login",
                "create_api_key": "POST /apikey/create",
                "protected": "GET /protected",
                "create_app_key": "POST /auth/apikeys",
                "list_app_keys": "GET /auth/apikeys",
                "revoke_app_key": "DELETE /auth/apikeys/{key_id}"
            },
            "admin": {
                "me_logs": "GET /admin/me/logs"
            },
            "data": {
                "upload": "POST /data/upload",
                "list_uploads": "GET /data/uploads",
                "get_upload": "GET /data/upload/{file_id}",
                "delete_upload": "DELETE /data/upload/{file_id}"
            },
            "analysis": {  # ← ADD THIS
                "create_summary": "POST /analysis/ai-summary",
                "list_summaries": "GET /analysis/summaries",
                "get_summary": "GET /analysis/summary/{summary_id}"
            }
        },
        "docs": "/docs"
    }

    #make a /ping endpoint that returns {"message": "pong"}



@app.get("/ping", tags=["Health"])
def ping():
    //Add more to the /ping endpoint
    return {"message": "pong"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
