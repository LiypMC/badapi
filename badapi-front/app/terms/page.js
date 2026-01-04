"use client";

export default function TermsPage() {
  return (
    <section className="section">
      <div className="panel">
        <h2>Terms of Service</h2>
        <p className="muted">
          By using BadAPI, you agree to these terms. This project is open source and
          provided as-is. Please review the repository for the full license text.
        </p>
      </div>

      <div className="grid">
        <div className="glass" style={{ padding: "22px" }}>
          <h3>Service Access</h3>
          <p className="muted">
            You are responsible for safeguarding API keys, session tokens, and credentials.
            Do not share keys publicly or embed them in client-side apps.
          </p>
        </div>
        <div className="glass" style={{ padding: "22px" }}>
          <h3>Usage Limits</h3>
          <p className="muted">
            Rate limits and quotas apply. Excessive or abusive usage may be throttled or blocked.
          </p>
        </div>
        <div className="glass" style={{ padding: "22px" }}>
          <h3>Content</h3>
          <p className="muted">
            Upload only data you have rights to use. You remain responsible for any content
            processed by the API.
          </p>
        </div>
        <div className="glass" style={{ padding: "22px" }}>
          <h3>Open Source License</h3>
          <p className="muted">
            The project is distributed under an open source license. Refer to the repository
            license file for full terms and conditions.
          </p>
        </div>
      </div>
    </section>
  );
}
