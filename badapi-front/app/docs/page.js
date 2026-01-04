"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

const sections = [
  { id: "overview", title: "Overview" },
  { id: "auth", title: "Auth + Sessions" },
  { id: "apikeys", title: "API Keys" },
  { id: "uploads", title: "Uploads" },
  { id: "downloads", title: "Downloads" },
  { id: "analysis", title: "AI Summaries" },
  { id: "logs", title: "Request Logs" },
  { id: "limits", title: "Rate Limits + Caps" },
  { id: "errors", title: "Errors" },
  { id: "examples", title: "Examples" }
];

const endpoints = [
  {
    group: "Auth",
    method: "POST",
    path: "/user/register",
    auth: "None",
    body: { username: "string", password: "string" },
    desc: "Register a new user."
  },
  {
    group: "Auth",
    method: "POST",
    path: "/user/login",
    auth: "None",
    body: { username: "string", password: "string" },
    desc: "Login and receive session token + JWT."
  },
  {
    group: "Auth",
    method: "POST",
    path: "/apikey/create",
    auth: "None",
    body: { username: "string", password: "string", replace: "boolean?" },
    desc: "Legacy key creation (single key on user record)."
  },
  {
    group: "Auth",
    method: "GET",
    path: "/protected",
    auth: "API Key",
    desc: "Sample protected endpoint."
  },
  {
    group: "API Keys",
    method: "POST",
    path: "/auth/apikeys",
    auth: "Session Token",
    body: { name: "string?" },
    desc: "Create a new API key (raw key returned once)."
  },
  {
    group: "API Keys",
    method: "GET",
    path: "/auth/apikeys",
    auth: "Session Token",
    desc: "List keys (no raw key, last4 only)."
  },
  {
    group: "API Keys",
    method: "DELETE",
    path: "/auth/apikeys/{key_id}",
    auth: "Session Token",
    desc: "Revoke a key."
  },
  {
    group: "Uploads",
    method: "POST",
    path: "/data/upload",
    auth: "API Key",
    body: { file: "CSV file (multipart/form-data)" },
    desc: "Upload CSV to R2 with metadata."
  },
  {
    group: "Uploads",
    method: "GET",
    path: "/data/uploads",
    auth: "API Key",
    desc: "List uploads."
  },
  {
    group: "Uploads",
    method: "GET",
    path: "/data/upload/{file_id}",
    auth: "API Key",
    desc: "Get a single upload."
  },
  {
    group: "Downloads",
    method: "POST",
    path: "/data/upload/{file_id}/link",
    auth: "API Key",
    desc: "Create a one-time download token."
  },
  {
    group: "Downloads",
    method: "GET",
    path: "/data/download/{token}",
    auth: "Token",
    desc: "Exchange token for a presigned URL."
  },
  {
    group: "Uploads",
    method: "DELETE",
    path: "/data/upload/{file_id}",
    auth: "API Key",
    desc: "Delete upload + metadata."
  },
  {
    group: "AI Summaries",
    method: "POST",
    path: "/analysis/ai-summary",
    auth: "API Key",
    body: { file_id: "string" },
    desc: "Generate or fetch AI summary for an upload."
  },
  {
    group: "AI Summaries",
    method: "GET",
    path: "/analysis/summaries",
    auth: "API Key",
    desc: "List AI summaries."
  },
  {
    group: "AI Summaries",
    method: "GET",
    path: "/analysis/summary/{summary_id}",
    auth: "API Key",
    desc: "Get a specific summary."
  },
  {
    group: "Logs",
    method: "GET",
    path: "/admin/me/logs?limit=50",
    auth: "JWT",
    desc: "Fetch request logs (newest first)."
  }
];

const limits = [
  { bucket: "General API", limit: "60/min", detail: "Burst + general API usage." },
  { bucket: "General API", limit: "10/sec", detail: "Optional burst cap." },
  { bucket: "General API", limit: "5,000/day", detail: "Daily quota." },
  { bucket: "AI Summaries", limit: "1/min", detail: "Option A minute cap." },
  { bucket: "AI Summaries", limit: "5/day", detail: "Option A daily cap." },
  { bucket: "Uploads", limit: "20/day", detail: "CSV uploads per day." },
  { bucket: "Download Links", limit: "120/hour", detail: "Token links per hour." }
];

export default function DocsPage() {
  const [query, setQuery] = useState("");

  const filteredEndpoints = useMemo(() => {
    if (!query) return endpoints;
    const q = query.toLowerCase();
    return endpoints.filter((ep) =>
      `${ep.group} ${ep.method} ${ep.path} ${ep.desc}`.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <section className="docs-layout">
      <aside className="docs-sidebar glass">
        <h3>Docs</h3>
        <input
          className="input"
          placeholder="Search endpoints..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <nav className="docs-nav">
          {sections.map((section) => (
            <a key={section.id} href={`#${section.id}`}>
              {section.title}
            </a>
          ))}
        </nav>
      </aside>

      <div className="docs-content">
        <div id="overview" className="glass docs-card">
          <h2>BadAPI Docs</h2>
          <p className="muted">
            Base URL: <span className="mono">https://badapi.fly.dev</span>
          </p>
          <p>
            This API supports CSV uploads, AI summaries, and per-device API keys. Use
            session tokens for key management and JWT for request logs. All other
            endpoints require an API key.
          </p>
          <pre className="codeblock">{`Authorization: Bearer <api_key>
Authorization: Bearer <session_token>
Authorization: Bearer <jwt>`}</pre>
          <div className="actions">
            <Link className="btn" href="/auth">Get Tokens</Link>
            <Link className="btn secondary" href="/keys">Manage Keys</Link>
          </div>
        </div>

        <div id="auth" className="glass docs-card">
          <h2>Auth + Sessions</h2>
          <p className="muted">Login returns a session token + JWT.</p>
          <div className="docs-two">
            <div>
              <h4>Register</h4>
              <pre className="codeblock">{`POST /user/register
{
  "username": "nova",
  "password": "supersecure"
}`}</pre>
            </div>
            <div>
              <h4>Login</h4>
              <pre className="codeblock">{`POST /user/login
{
  "username": "nova",
  "password": "supersecure"
}

Response:
{
  "session_token": "...",
  "jwt": "..."
}`}</pre>
            </div>
          </div>
        </div>

        <div id="apikeys" className="glass docs-card">
          <h2>API Keys</h2>
          <p className="muted">Requires session token. Use Authorization: Bearer &lt;session_token&gt;.</p>
          <pre className="codeblock">{`POST /auth/apikeys
Authorization: Bearer <session_token>
{
  "name": "laptop"
}`}</pre>
          <pre className="codeblock">{`GET /auth/apikeys
Authorization: Bearer <session_token>`}</pre>
          <pre className="codeblock">{`DELETE /auth/apikeys/{key_id}
Authorization: Bearer <session_token>`}</pre>
        </div>

        <div id="uploads" className="glass docs-card">
          <h2>Uploads</h2>
          <p className="muted">All upload endpoints require API key auth.</p>
          <p className="muted">
            Requirements: file must be <span className="mono">.csv</span>, max size 200 MB,
            max rows 200k, max columns 200.
          </p>
          <pre className="codeblock">{`POST /data/upload
Authorization: Bearer <api_key>
Content-Type: multipart/form-data
file: <your.csv>`}</pre>
          <pre className="codeblock">{`GET /data/uploads
Authorization: Bearer <api_key>`}</pre>
          <pre className="codeblock">{`GET /data/upload/{file_id}
Authorization: Bearer <api_key>`}</pre>
          <pre className="codeblock">{`DELETE /data/upload/{file_id}
Authorization: Bearer <api_key>`}</pre>
        </div>

        <div id="downloads" className="glass docs-card">
          <h2>Downloads</h2>
          <pre className="codeblock">{`POST /data/upload/{file_id}/link
Authorization: Bearer <api_key>`}</pre>
          <pre className="codeblock">{`GET /data/download/{token}`}</pre>
          <p className="muted">
            The download token endpoint has the general rate limits applied by user_id.
          </p>
        </div>

        <div id="analysis" className="glass docs-card">
          <h2>AI Summaries</h2>
          <pre className="codeblock">{`POST /analysis/ai-summary
Authorization: Bearer <api_key>
{
  "file_id": "..."
}`}</pre>
          <pre className="codeblock">{`GET /analysis/summaries
Authorization: Bearer <api_key>`}</pre>
          <pre className="codeblock">{`GET /analysis/summary/{summary_id}
Authorization: Bearer <api_key>`}</pre>
        </div>

        <div id="logs" className="glass docs-card">
          <h2>Request Logs (JWT)</h2>
          <pre className="codeblock">{`GET /admin/me/logs?limit=50
Authorization: Bearer <jwt>`}</pre>
          <p className="muted">
            Logs include timestamp, api_key_id, method, path, status_code, latency_ms, upload_id, ip, user_agent.
          </p>
        </div>

        <div id="limits" className="glass docs-card">
          <h2>Rate Limits + Caps</h2>
          <p className="muted">
            Rate-limited responses include <span className="mono">X-RateLimit-*</span> headers
            and return <span className="mono">429</span>.
          </p>
          <table className="table">
            <thead>
              <tr>
                <th>Bucket</th>
                <th>Limit</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {limits.map((limit) => (
                <tr key={`${limit.bucket}-${limit.limit}`}>
                  <td>{limit.bucket}</td>
                  <td className="mono">{limit.limit}</td>
                  <td className="muted">{limit.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted">
            File caps: max size 200 MB, max rows 200k, max columns 200.
          </p>
        </div>

        <div id="errors" className="glass docs-card">
          <h2>Errors</h2>
          <p className="muted">Errors follow FastAPI conventions.</p>
          <pre className="codeblock">{`HTTP/1.1 429 Too Many Requests
{
  "detail": "Rate limit exceeded"
}`}</pre>
          <pre className="codeblock">{`HTTP/1.1 401 Unauthorized
{
  "detail": "Invalid API key"
}`}</pre>
        </div>

        <div id="examples" className="glass docs-card">
          <h2>Examples</h2>
          <div className="docs-two">
            <div>
              <h4>Python</h4>
              <pre className="codeblock">{`import requests

API = "https://badapi.fly.dev"
API_KEY = "your_api_key"

resp = requests.get(
  f"{API}/data/uploads",
  headers={"Authorization": f"Bearer {API_KEY}"}
)
print(resp.json())`}</pre>
            </div>
            <div>
              <h4>Java (HttpClient)</h4>
              <pre className="codeblock">{`import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

String api = "https://badapi.fly.dev";
String apiKey = "your_api_key";

HttpClient client = HttpClient.newHttpClient();
HttpRequest request = HttpRequest.newBuilder()
  .uri(URI.create(api + "/data/uploads"))
  .header("Authorization", "Bearer " + apiKey)
  .GET()
  .build();

HttpResponse<String> response = client.send(
  request, HttpResponse.BodyHandlers.ofString()
);
System.out.println(response.body());`}</pre>
            </div>
          </div>
        </div>

        <div className="glass docs-card">
          <h2>Endpoint Index</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Group</th>
                <th>Method</th>
                <th>Path</th>
                <th>Auth</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {filteredEndpoints.map((ep) => (
                <tr key={`${ep.method}-${ep.path}`}>
                  <td>{ep.group}</td>
                  <td className="mono">{ep.method}</td>
                  <td className="mono">{ep.path}</td>
                  <td>{ep.auth}</td>
                  <td className="muted">{ep.desc}</td>
                </tr>
              ))}
              {!filteredEndpoints.length && (
                <tr>
                  <td colSpan="5" className="muted">
                    No endpoints match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
