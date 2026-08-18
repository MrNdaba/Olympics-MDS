import { requireUser } from "@/lib/auth";
import { getTranslations } from "@/lib/lang";
import { prisma } from "@/lib/db";
import { TopBar, type NavItem } from "@/components/TopBar";
import { adminNav, vlmNav } from "@/lib/nav";
import { SettingsForm } from "@/components/SettingsForm";

export default async function SettingsPage() {
  const user = await requireUser();
  const { lang, t } = await getTranslations();

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { phone: true, mustChangePassword: true },
  });

  const nav: NavItem[] =
    user.role === "admin"
      ? adminNav("dashboard", t)
      : user.role === "vlm"
        ? vlmNav("bookings", t)
        : [
            { href: "/supplier", label: t.navNew, active: false },
            { href: "/supplier#mine", label: t.navMine, active: false },
          ];

  return (
    <div style={{ minHeight: "100vh" }}>
      <TopBar user={user} lang={lang} t={t} nav={nav} subtitle={t.settingsTitle} />
      <main style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, maxWidth: 1000, margin: "0 auto" }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>{t.settingsTitle}</h1>
          <p style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>{t.settingsSub}</p>
        </div>
        <SettingsForm
          t={t}
          phone={record?.phone ?? ""}
          mustChange={record?.mustChangePassword ?? false}
        />
      </main>
    </div>
  );
}
