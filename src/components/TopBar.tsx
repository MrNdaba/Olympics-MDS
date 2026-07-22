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
  const roleKey = ROLE_LABEL[user.role];
  const roleText = roleKey ? t[roleKey] : subtitle ?? user.role.toUpperCase();

  return (
    <>
      <header
        style={{
          height: 56,
          background: "#fff",
          borderBottom: "1px solid var(--border-card)",
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "0 20px",
        }}
      >
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
            <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{t.appSub}</div>
          </div>
        </div>

        <nav style={{ display: "flex", gap: 4, marginLeft: 10 }}>
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: "6px 12px",
                borderRadius: 7,
                fontSize: 12.5,
                fontWeight: item.active ? 600 : 500,
                background: item.active ? "var(--blue-tint-bg)" : "transparent",
                color: item.active ? "var(--blue-tint-text)" : "var(--text-secondary)",
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>
          {liveBadge && (
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
              <span
                style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--st-confirmed)" }}
              />
              {t.autoRefresh}
            </span>
          )}
          <LangSwitcher lang={lang} />
          <Link
            href="/help"
            title={t.help}
            style={{
              border: "1px solid var(--border-control)",
              background: "#fff",
              borderRadius: 7,
              padding: "6px 10px",
              fontSize: 11.5,
              fontWeight: 600,
              color: "var(--text-secondary)",
            }}
          >
            {t.help}
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                background: user.role === "vlm" ? "#12202E" : "var(--blue)",
                color: "#fff",
                display: "grid",
                placeItems: "center",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <div style={{ lineHeight: 1.15 }}>
              <div style={{ fontWeight: 600, fontSize: 12 }}>{user.name}</div>
              <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{roleText}</div>
            </div>
          </div>
          <Link
            href="/settings"
            title={t.navSettings}
            style={{
              border: "1px solid var(--border-control)",
              background: "#fff",
              borderRadius: 7,
              padding: "6px 10px",
              fontSize: 11.5,
              fontWeight: 600,
              color: "var(--text-secondary)",
            }}
          >
            {t.navSettings}
          </Link>
          <form action={logout}>
            <button
              type="submit"
              style={{
                border: "1px solid var(--border-control)",
                background: "#fff",
                borderRadius: 7,
                padding: "6px 10px",
                fontSize: 11.5,
                fontWeight: 600,
                color: "var(--text-secondary)",
              }}
            >
              {t.logout}
            </button>
          </form>
        </div>
      </header>
      <div className="mosaic-strip" />
    </>
  );
}
