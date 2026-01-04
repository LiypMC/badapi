# BadAPI
Small-batch data API for uploads, AI summaries, and API key management. Built with FastAPI + MongoDB + R2 and paired with a Next.js control panel.

Quick links: [Docs](badapi-front/app/docs/page.js) | [Frontend](badapi-front) | [Backend](main.py) | [License](LICENSE)

## What this is
- A CSV upload service that stores files in R2 and metadata in MongoDB.
- Per-device API keys with rotation, revocation, and usage logging.
- AI summaries via DeepSeek with usage limits and request logs.
- A modern frontend dashboard for operators and developers.

## Architecture
- **API**: FastAPI app (root: `main.py`)
- **DB**: MongoDB (`auth_db`)
- **Storage**: Cloudflare R2 (S3-compatible)
- **AI**: DeepSeek API
- **Frontend**: Next.js + Three.js (`badapi-front/`)

## Auth model
- **Session token**: obtained on `/user/login`; used for API key management.
- **API key**: used for all data/AI endpoints.
- **JWT**: returned on login; used for `/admin/me/logs`.
- Legacy single key in `users.api_key` still works (fallback).

## Rate limits + caps
General API:
- 10 requests/sec
- 60 requests/min
- 5,000 requests/day

AI summaries:
- 1 summary/min
- 5 summaries/day

Uploads:
- 20 uploads/day

Download links:
- 120 links/hour

File caps:
- 200 MB max file size
- 200k max rows
- 200 max columns

## Key endpoints
Auth:
- `POST /user/register`
- `POST /user/login` (returns session token + JWT)
- `POST /apikey/create` (legacy)

API keys (session token):
- `POST /auth/apikeys`
- `GET /auth/apikeys`
- `DELETE /auth/apikeys/{key_id}`

Uploads (API key):
- `POST /data/upload`
- `GET /data/uploads`
- `GET /data/upload/{file_id}`
- `POST /data/upload/{file_id}/link`
- `DELETE /data/upload/{file_id}`

AI summaries (API key):
- `POST /analysis/ai-summary`
- `GET /analysis/summaries`
- `GET /analysis/summary/{summary_id}`

Logs (JWT):
- `GET /admin/me/logs?limit=50`

## Environment variables
Required:
- `MONGO_URI`
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`
- `DOWNLOAD_TOKEN_SECRET`
- `DEEPSEEK_API_KEY`
- `API_KEY_SECRET`
- `SESSION_TOKEN_SECRET`

Optional:
- `SESSION_TTL_SECONDS` (default 86400)
- `JWT_TTL_SECONDS` (default 3600)
- `PUBLIC_BASE_URL`
- `DOWNLOAD_TOKEN_TTL_SECONDS` (default 60)
- `R2_PRESIGN_TTL_SECONDS` (default 60)
- `DOWNLOAD_BIND_IP` / `DOWNLOAD_BIND_UA`

## Local dev
Backend:
```
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Frontend:
```
cd badapi-front
npm install
npm run dev
```

## Deploy
Backend (Fly.io):
- Uses `Dockerfile`, `requirements.txt`, `fly.toml`
- Set secrets with `fly secrets set`

Frontend (Cloudflare Pages):
- Root directory: `badapi-front`
- Framework: Next.js
- Build command: `npm run build`
- Output: `.next`
- Enable `nodejs_compat`
- Set `NEXT_PUBLIC_API_URL=https://badapi.fly.dev`

## License
MIT. See `LICENSE`.
