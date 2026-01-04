"use client";

import { useEffect, useState } from "react";
import { clearAuth, getApiKey, getJwt, getSessionToken } from "../../lib/storage";

export default function ProfilePage() {
  const [sessionToken, setSessionToken] = useState("");
  const [jwt, setJwt] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [reveal, setReveal] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setSessionToken(getSessionToken());
    setJwt(getJwt());
    setApiKey(getApiKey());
  }, []);

  const handleLogout = () => {
    clearAuth();
    setSessionToken("");
    setJwt("");
    setApiKey("");
    setMessage("Logged out. Local tokens cleared.");
  };

  const mask = (value) => {
    if (!value) return "—";
    if (reveal) return value;
    return `${value.slice(0, 6)}...${value.slice(-4)}`;
  };

  return (
    <section className="section">
      <div className="panel">
        <h2>Profile + Tokens</h2>
        <p className="muted">Manage stored tokens and logout safely.</p>
        <div className="form">
          <label className="muted">Session Token</label>
          <input className="input mono" value={mask(sessionToken)} readOnly />
          <label className="muted">JWT</label>
          <input className="input mono" value={mask(jwt)} readOnly />
          <label className="muted">API Key</label>
          <input className="input mono" value={mask(apiKey)} readOnly />
          <div className="actions">
            <button className="btn secondary" type="button" onClick={() => setReveal(!reveal)}>
              {reveal ? "Hide tokens" : "Reveal tokens"}
            </button>
            <button className="btn" type="button" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </div>
        {message && <div className="alert success">{message}</div>}
      </div>
    </section>
  );
}
