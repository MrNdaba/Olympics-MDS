import { requireRole } from "@/lib/auth";
import { getTranslations } from "@/lib/lang";
import { prisma } from "@/lib/db";
import { TopBar, type NavItem } from "@/components/TopBar";
import { adminNav } from "@/lib/nav";
import { MasterDataAdmin, type MasterDataRow } from "@/components/admin/MasterDataAdmin";

export default async function AdminMasterDataPage() {
  const admin = await requireRole("admin");
  const { lang, t } = await getTranslations();

  const entries = await prisma.masterData.findMany({
    orderBy: [{ category: "asc" }, { label: "asc" }],
  });

  const rows: MasterDataRow[] = entries.map((e) => ({
    id: e.id,
    category: e.category,
    label: e.label,
    active: e.active,
  }));

  const nav: NavItem[] = adminNav("masterData", t);

  return (
    <div style={{ minHeight: "100vh" }}>
      <TopBar user={admin} lang={lang} t={t} nav={nav} />
      <main style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, maxWidth: 1360, margin: "0 auto" }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>{t.masterDataTitle}</h1>
          <p style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>{t.masterDataSub}</p>
        </div>
        <MasterDataAdmin t={t} lang={lang} rows={rows} />
      </main>
    </div>
  );
}
