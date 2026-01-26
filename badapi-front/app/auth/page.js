"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { request } from "../../lib/api";
import { getSessionToken, setSessionToken, setJwt } from "../../lib/storage";

export default function AuthPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getSessionToken()) {
      router.push("/dashboard");
    }
  }, [router]);

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
      setMessage("Session token + JWT stored. Redirecting...");
      setTimeout(() => router.push("/dashboard"), 700);
    } catch (err) {
      setError(err.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="split">
      <div className="panel">
        <span className="pill">Access</span>
        <h2>Sign in</h2>
        <p className="muted">
          Use your account to generate a session token and JWT for key management and logs.
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
            Need an account? Create one on the <a href="/register">register</a> page.
          </p>
        </form>
        {message && <div className="alert success">{message}</div>}
        {error && <div className="alert">{error}</div>}
      </div>

      <div className="panel">
        <h3>What you unlock</h3>
        <ul className="list">
          <li>Per-device API keys with labels and revocation.</li>
          <li>CSV upload management and AI summaries.</li>
          <li>Request logs and rate limits visibility.</li>
        </ul>
        <div className="note">
          Security: tokens are stored locally in your browser. Log out on shared devices.
        </div>
      </div>
    </section>
  );
}
