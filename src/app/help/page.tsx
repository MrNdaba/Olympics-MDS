import { requireUser } from "@/lib/auth";
import { getTranslations } from "@/lib/lang";
import { TopBar, type NavItem } from "@/components/TopBar";
import { adminNav, supplierNav, vlmNav } from "@/lib/nav";

// Per-role user guide. A supplier only ever sees the supplier guide; VLM and
// Admin see their own guide. Content is a placeholder for now (spec §22 help).
export default async function HelpPage() {
  const user = await requireUser();
  const { lang, t } = await getTranslations();

  // Role-appropriate navigation (no item active — Help is outside the main nav).
  const nav: NavItem[] = (
    user.role === "admin"
      ? adminNav("users", t)
      : user.role === "vlm" || user.role === "viewer"
        ? vlmNav("bookings", t)
        : supplierNav("new", t)
  ).map((n) => ({ ...n, active: false }));

  const roleGuide =
    user.role === "admin"
      ? t.roleAdmin
      : user.role === "vlm"
        ? t.roleVlm
        : user.role === "viewer"
          ? t.roleViewer
          : t.roleSupplierShort;

  return (
    <div style={{ minHeight: "100vh" }}>
      <TopBar user={user} lang={lang} t={t} nav={nav} />
      <main style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, maxWidth: 900, margin: "0 auto" }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>{t.userGuide}</h1>
          <p style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>{roleGuide}</p>
        </div>
        <div
          style={{
            background: "#fff",
            border: "1px solid var(--border-card)",
            borderRadius: 10,
            padding: "40px 24px",
            textAlign: "center",
            color: "var(--text-secondary)",
            fontSize: 13,
          }}
        >
          {t.guidePlaceholder}
        </div>
      </main>
    </div>
  );
}
