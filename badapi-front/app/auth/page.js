"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { request } from "../../lib/api";
import { setSessionToken, setJwt } from "../../lib/storage";

export default function AuthPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const { data } = await request("/user/login", {
        method: "POST",
        body: JSON.stringify({ username, password })
      });
      setSessionToken(data.session_token);
      setJwt(data.jwt);
      setMessage("Session token + JWT stored. Redirecting to API keys...");
      setTimeout(() => router.push("/keys"), 700);
    } catch (err) {
      setError(err.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="split">
      <div className="panel">
        <span className="pill">Operator Access</span>
        <h2>Sign in to your workspace</h2>
        <p className="muted">
          Use your username + password to generate a session token and JWT. We cache both
          locally so you can manage keys, uploads, and summaries like a real control room.
        </p>
        <form className="form" onSubmit={handleLogin}>
          <input
            className="input"
            placeholder="Username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
          <input
            className="input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <button className="btn" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Login"}
          </button>
          <p className="muted">
            Forgot password? Contact support to reset credentials.
          </p>
          <p className="muted">
            Need an account? Create one on the <a href="/register">register</a> page.
          </p>
        </form>
        {message && <div className="alert success">{message}</div>}
        {error && <div className="alert">{error}</div>}
      </div>

      <div className="panel">
        <h3>Realtime control preview</h3>
        <p className="muted">
          Live-ish demo of a client run: API key auth, upload, summary response. The
          interface mirrors what your developers will see.
        </p>
        <div className="feature-window">
          <div className="floating-cubes">
            <div className="cube" />
            <div className="cube" />
            <div className="cube" />
          </div>
          <div className="demo-line" />
          <pre className="codeblock">{`POST /data/upload
Authorization: Bearer <api_key>
file: metrics.csv

200 OK -> file_id: 65f9...9a1`}</pre>
          <pre className="codeblock">{`POST /analysis/ai-summary
{ "file_id": "65f9...9a1" }

200 OK -> summary cached: false`}</pre>
        </div>
      </div>
    </section>
  );
}
