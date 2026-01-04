"use client";

import Link from "next/link";

export default function Footer() {
  return (
    <footer className="footer">
      <div>
        <span className="mono">BadAPI</span> • Secure data ops + AI summaries • Open source
      </div>
      <div className="footer-links">
        <Link href="/docs">Docs</Link>
        <Link href="/team">Team</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
      </div>
    </footer>
  );
}
