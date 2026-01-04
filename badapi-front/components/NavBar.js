"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { clearAuth, getSessionToken } from "../lib/storage";

const links = [
  { href: "/", label: "Home" },
  { href: "/auth", label: "Login" },
  { href: "/keys", label: "API Keys" },
  { href: "/files", label: "Files" },
  { href: "/summaries", label: "Summaries" },
  { href: "/docs", label: "Docs" },
  { href: "/profile", label: "Profile" },
  { href: "/terms", label: "Terms" }
];

export default function NavBar() {
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(!!getSessionToken());
  }, [pathname]);

  const handleLogout = () => {
    clearAuth();
    setLoggedIn(false);
  };

  return (
    <nav className="nav glass">
      <div className="nav-inner">
        <div className="logo">
          <span className="logo-dot" />
          <span>BadAPI</span>
        </div>
        <div className="nav-links">
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
