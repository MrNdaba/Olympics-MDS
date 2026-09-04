"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Dict, Lang } from "@/lib/i18n";
import type { SessionUser } from "@/lib/auth";
import { LangSwitcher } from "./LangSwitcher";
import { logout } from "@/lib/session-actions";

export interface NavItem {
  href: string;
  label: string;
  active: boolean;
}

const ROLE_LABEL: Record<string, keyof Dict | null> = {
  supplier: "roleSupplier",
  vlm: null,
  admin: null,
};

export function TopBar({
  user,
  lang,
  t,
  nav,
  subtitle,
  liveBadge,
}: {
  user: SessionUser;
  lang: Lang;
  t: Dict;
  nav: NavItem[];
  subtitle?: string;
  liveBadge?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const roleKey = ROLE_LABEL[user.role];
  const roleText = roleKey ? t[roleKey] : subtitle ?? user.role.toUpperCase();

  const navLinkStyle = (active: boolean): React.CSSProperties => ({
    padding: "6px 9px",
    borderRadius: 7,
    fontSize: 12.5,
    fontWeight: active ? 600 : 500,
    background: active ? "var(--blue-tint-bg)" : "transparent",
    color: active ? "var(--blue-tint-text)" : "var(--text-secondary)",
  });
  const iconLinkStyle: React.CSSProperties = {
    border: "1px solid var(--border-control)",
    background: "#fff",
    borderRadius: 7,
    padding: "6px 10px",
    fontSize: 11.5,
    fontWeight: 600,
    color: "var(--text-secondary)",
  };

  return (
    <>
      <header className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Image
            src="/dakar2026-logo.png"
            alt="Dakar 2026"
            width={80}
            height={38}
            style={{ height: 38, width: "auto" }}
            priority
          />
          <span style={{ width: 1, height: 30, background: "var(--border-card)" }} />
          <div style={{ lineHeight: 1.1 }}>
            <div style={{ fontWeight: 800, fontSize: 13.5 }}>MDS</div>
            <div className="topbar-brand-sub" style={{ fontSize: 10, color: "var(--text-secondary)" }}>
              {t.appSub}
            </div>
          </div>
        </div>

        <nav className="topbar-nav-desktop">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} style={navLinkStyle(item.active)}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="topbar-actions-desktop">
          {liveBadge && <LiveBadge t={t} />}
          <LangSwitcher lang={lang} />
          <Link href="/help" title={t.help} style={iconLinkStyle}>
            {t.help}
          </Link>
          <UserBadge user={user} roleText={roleText} />
          <Link href="/settings" title={t.navSettings} style={iconLinkStyle}>
            {t.navSettings}
          </Link>
          <form action={logout}>
            <button type="submit" style={iconLinkStyle}>
              {t.logout}
            </button>
          </form>
        </div>

        <button
          type="button"
          className="topbar-toggle"
          aria-label={t.menu}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? "✕" : "☰"}
        </button>
      </header>

      {menuOpen && (
        <div className="topbar-mobile-panel">
          {liveBadge && (
            <div style={{ marginBottom: 8 }}>
              <LiveBadge t={t} />
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 4px 12px", minWidth: 0 }}>
            <UserBadge user={user} roleText={roleText} />
          </div>
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              style={{ ...navLinkStyle(item.active), padding: "10px 8px" }}
            >
              {item.label}
            </Link>
          ))}
          <span style={{ height: 1, background: "var(--divider)", margin: "8px 0" }} />
          <div style={{ padding: "4px 8px 10px" }}>
            <LangSwitcher lang={lang} />
          </div>
          <Link href="/help" onClick={() => setMenuOpen(false)} style={{ padding: "10px 8px", fontSize: 12.5, fontWeight: 500, color: "var(--text-secondary)" }}>
            {t.help}
          </Link>
          <Link href="/settings" onClick={() => setMenuOpen(false)} style={{ padding: "10px 8px", fontSize: 12.5, fontWeight: 500, color: "var(--text-secondary)" }}>
            {t.navSettings}
          </Link>
          <form action={logout}>
            <button
              type="submit"
              style={{
                width: "100%",
                marginTop: 4,
                border: "1px solid var(--border-control)",
                background: "#fff",
                borderRadius: 7,
                padding: "10px 8px",
                fontSize: 12.5,
                fontWeight: 600,
                color: "var(--text-secondary)",
              }}
            >
              {t.logout}
            </button>
          </form>
        </div>
      )}
      <div className="mosaic-strip" />
    </>
  );
}

function LiveBadge({ t }: { t: Dict }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 20,
        background: "var(--st-confirmed-bg)",
        color: "var(--st-confirmed-text)",
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--st-confirmed)" }} />
      {t.autoRefresh}
    </span>
  );
}

const truncate: React.CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

function UserBadge({ user, roleText }: { user: SessionUser; roleText: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
      <span
        style={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          background: user.role === "vlm" || user.role === "viewer" ? "#12202E" : "var(--blue)",
          color: "#fff",
          display: "grid",
          placeItems: "center",
          fontSize: 12,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {user.name.slice(0, 1).toUpperCase()}
      </span>
      {/* min-width:0 lets this shrink inside a flex row instead of pushing
          the header wider — a long name/venue label would otherwise force
          horizontal overflow, especially at the 320px small-phone floor. */}
      <div style={{ lineHeight: 1.15, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 12, ...truncate }}>{user.name}</div>
        <div style={{ fontSize: 10, color: "var(--text-secondary)", ...truncate }}>{roleText}</div>
      </div>
    </div>
  );
}
