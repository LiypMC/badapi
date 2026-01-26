"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { clearAuth, getSessionToken } from "../lib/storage";

const links = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/auth", label: "Login" },
  { href: "/keys", label: "API Keys" },
  { href: "/files", label: "Files" },
  { href: "/summaries", label: "Summaries" },
  { href: "/docs", label: "Docs" }
];

export default function NavBar() {
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setLoggedIn(!!getSessionToken());
    setOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    clearAuth();
    setLoggedIn(false);
    setOpen(false);
  };

  return (
    <nav className="nav glass">
      <div className="nav-inner">
        <div className="logo">
          <span className="logo-dot" />
          <span>BadAPI</span>
        </div>
        <button className="nav-toggle" type="button" onClick={() => setOpen(!open)}>
          <span />
          <span />
          <span />
        </button>
        <div className={`nav-links ${open ? "open" : ""}`}>
          <div className="nav-links-header">
            <span className="logo">
              <span className="logo-dot" />
              <span>BadAPI</span>
            </span>
            <button className="nav-close" type="button" onClick={() => setOpen(false)}>
              ×
            </button>
          </div>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={pathname === link.href ? "active" : ""}
            >
              {link.label}
            </Link>
          ))}
          {loggedIn && (
            <button className="nav-btn" type="button" onClick={handleLogout}>
              Log out
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
