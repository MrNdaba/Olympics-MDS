import { requireRole } from "@/lib/auth";
import { getTranslations } from "@/lib/lang";
import { prisma } from "@/lib/db";
import { TopBar, type NavItem } from "@/components/TopBar";
import { adminNav } from "@/lib/nav";
import { VenuesAdmin, type VenueRow } from "@/components/admin/VenuesAdmin";

export default async function AdminVenuesPage() {
  const admin = await requireRole("admin");
  const { lang, t } = await getTranslations();

  const venues = await prisma.venue.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { bookings: true } } },
  });

  const rows: VenueRow[] = venues.map((v) => ({
    id: v.id,
    name: v.name,
    siteCode: v.siteCode,
    city: v.city,
    status: v.status,
    slotDuration: v.defaultSlotDurationMinutes,
    bookings: v._count.bookings,
  }));

  const nav: NavItem[] = adminNav("venues", t);

  return (
    <div style={{ minHeight: "100vh" }}>
      <TopBar user={admin} lang={lang} t={t} nav={nav} />
      <main style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, maxWidth: 1360, margin: "0 auto" }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>{t.venuesTitle}</h1>
          <p style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>{t.venuesSub}</p>
        </div>
        <VenuesAdmin t={t} venues={rows} />
      </main>
    </div>
  );
}
