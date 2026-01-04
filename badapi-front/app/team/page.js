"use client";

export default function TeamPage() {
  return (
    <section className="section">
      <div className="panel">
        <h2>Team</h2>
        <p className="muted">
          BadAPI is built by a small, security-obsessed crew shipping fast data tooling.
          We design for reliability, clear UX, and cost-aware AI usage.
        </p>
      </div>

      <div className="grid">
        {[
          { name: "Product", desc: "API design, workflows, and docs." },
          { name: "Platform", desc: "Infra, storage, and auth hardening." },
          { name: "AI", desc: "Summary quality, prompts, and safety." }
        ].map((item) => (
          <div key={item.name} className="glass" style={{ padding: "22px" }}>
            <h3>{item.name}</h3>
            <p className="muted">{item.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
