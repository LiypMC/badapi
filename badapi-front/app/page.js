"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <section className="section">
      <div className="hero">
        <div>
          <span className="pill">BadAPI Platform</span>
          <h1>Clean, minimal control for uploads, AI summaries, and keys.</h1>
          <p>
            Upload CSVs, manage keys per device, and trigger AI summaries in seconds.
            Designed for teams shipping data products. API at{" "}
            <span className="mono">badapi.fly.dev</span>.
          </p>
          <div className="actions">
            <Link className="btn" href="/auth">Get Session Token</Link>
            <Link className="btn secondary" href="/files">Manage Files</Link>
          </div>
        </div>
        <div className="panel">
          <h3>Production ready</h3>
          <p className="muted">
            Per-device API keys, request logs, rate limits, and AI cost controls out
            of the box.
          </p>
          <div className="stats">
            <div>
              <div className="stat-label">Rate limits</div>
              <div className="stat-value">5k/day</div>
            </div>
            <div>
              <div className="stat-label">AI summaries</div>
              <div className="stat-value">5/day</div>
            </div>
            <div>
              <div className="stat-label">Uploads</div>
              <div className="stat-value">20/day</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid">
        <div className="panel">
          <h3>Auth + JWT</h3>
          <p className="muted">
            Login with username/password to obtain a session token and JWT for admin views.
          </p>
        </div>
        <div className="panel">
          <h3>API Key Vault</h3>
          <p className="muted">
            Mint, label, and revoke keys per device without breaking active apps.
          </p>
        </div>
        <div className="panel">
          <h3>AI Summaries</h3>
          <p className="muted">
            Trigger summaries against uploads while rate limits keep costs sane.
          </p>
        </div>
      </div>
    </section>
  );
}
