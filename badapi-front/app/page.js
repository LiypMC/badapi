"use client";

import Link from "next/link";
import HeroCanvas from "../components/HeroCanvas";

export default function HomePage() {
  return (
    <section className="section">
      <div className="hero">
        <div>
          <span className="pill">BadAPI Control Room</span>
          <h1>Command-grade control for uploads, AI summaries, and keys.</h1>
          <p>
            Monitor your datasets, rotate keys, and trigger AI analysis from a single
            cockpit. Built for the deployed API at <span className="mono">badapi.fly.dev</span>.
          </p>
          <div className="actions">
            <Link className="btn" href="/auth">Get Session Token</Link>
            <Link className="btn secondary" href="/files">Manage Files</Link>
          </div>
        </div>
        <HeroCanvas />
      </div>

      <div className="grid">
        <div className="glass glass-strong" style={{ padding: "22px" }}>
          <h3>Auth + JWT</h3>
          <p className="muted">
            Login with username/password to obtain a session token and JWT for admin views.
          </p>
        </div>
        <div className="glass glass-strong" style={{ padding: "22px" }}>
          <h3>API Key Vault</h3>
          <p className="muted">
            Mint, label, and revoke keys per device without breaking active apps.
          </p>
        </div>
        <div className="glass glass-strong" style={{ padding: "22px" }}>
          <h3>AI Summaries</h3>
          <p className="muted">
            Trigger summaries against uploads while rate limits keep costs sane.
          </p>
        </div>
      </div>

      <div className="floating-strip glass-strong">
        <div className="floating-cubes">
          <div className="cube" />
          <div className="cube" />
          <div className="cube" />
          <div className="cube" />
        </div>
        <div className="floating-cubes">
          <div className="cube" />
          <div className="cube" />
          <div className="cube" />
        </div>
      </div>
    </section>
  );
}
