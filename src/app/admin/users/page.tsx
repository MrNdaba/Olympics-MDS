import { requireRole } from "@/lib/auth";
import { getTranslations } from "@/lib/lang";
import { prisma } from "@/lib/db";
import { TopBar, type NavItem } from "@/components/TopBar";
import { adminNav } from "@/lib/nav";
import { UsersAdmin, type UserRow } from "@/components/admin/UsersAdmin";

export default async function AdminUsersPage() {
  const admin = await requireRole("admin");
  const { lang, t } = await getTranslations();

  const [users, venues] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ role: "asc" }, { name: "asc" }],
      include: { venueAssignments: { include: { venue: true } } },
    }),
    prisma.venue.findMany({
      where: { status: "active" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, siteCode: true },
    }),
  ]);

  const rows: UserRow[] = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    status: u.status,
    phone: u.phone ?? "",
    otpChannel: u.otpChannel,
    venues: u.venueAssignments.map((a) => a.venue.siteCode),
    venueIds: u.venueAssignments.map((a) => a.venueId),
  }));

  const nav: NavItem[] = adminNav("users", t);

  return (
    <div style={{ minHeight: "100vh" }}>
      <TopBar user={admin} lang={lang} t={t} nav={nav} />
      <main style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, maxWidth: 1360, margin: "0 auto" }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>{t.usersTitle}</h1>
          <p style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>{t.usersSub}</p>
        </div>
        <UsersAdmin t={t} users={rows} venues={venues} currentAdminId={admin.id} />
      </main>
    </div>
  );
}
