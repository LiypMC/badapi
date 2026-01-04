"use client";

export default function PrivacyPage() {
  return (
    <section className="section">
      <div className="panel">
        <h2>Privacy + Data Policy</h2>
        <p className="muted">
          We process CSV uploads and AI summaries strictly to provide the service. Logs and
          metadata are used for security, billing, and abuse prevention. This project is
          open source; refer to the repository license for full terms.
        </p>
        <div className="grid">
          <div className="glass" style={{ padding: "22px" }}>
            <h3>Data Stored</h3>
            <p className="muted">
              Upload metadata, AI summaries, key usage, and request logs. Raw files live in
              R2 storage. We do not sell user data.
            </p>
          </div>
          <div className="glass" style={{ padding: "22px" }}>
            <h3>Retention</h3>
            <p className="muted">
              Request logs are retained for security and auditing. You may request deletion
              of uploads and keys at any time.
            </p>
          </div>
          <div className="glass" style={{ padding: "22px" }}>
            <h3>Security</h3>
            <p className="muted">
              Keys are hashed at rest. Tokens are short-lived. Rate limits protect against abuse.
            </p>
          </div>
          <div className="glass" style={{ padding: "22px" }}>
            <h3>Acceptable Use</h3>
            <p className="muted">
              Do not upload sensitive regulated data. Abuse, scraping, or credential sharing
              may trigger suspension.
            </p>
          </div>
          <div className="glass" style={{ padding: "22px" }}>
            <h3>Contact</h3>
            <p className="muted">
              For privacy requests or deletions, contact support with your account email.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
