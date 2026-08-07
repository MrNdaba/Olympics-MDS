import { requireRole } from "@/lib/auth";
import { getTranslations } from "@/lib/lang";
import { prisma } from "@/lib/db";
import { ACTIVE_STATUSES, type BookingStatus } from "@/lib/constants";
import { formatShortDate, formatWindow, parseDakarDay } from "@/lib/time";
import { TopBar, type NavItem } from "@/components/TopBar";
import { MyBookings, type BookingRow } from "@/components/MyBookings";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { supplierNav } from "@/lib/nav";

export default async function SupplierBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const user = await requireRole("supplier");
  const { lang, t } = await getTranslations();
  const sp = await searchParams;

  // Same standard date-range filter as the VLM/Admin booking views (serviceDate,
  // Dakar-local day bounds) — kept consistent via the shared DateRangeFilter.
  const where: Record<string, unknown> = { createdById: user.id };
  const dateRange: Record<string, Date> = {};
  if (sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from)) dateRange.gte = parseDakarDay(sp.from);
  if (sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to)) dateRange.lte = parseDakarDay(sp.to);
  if (Object.keys(dateRange).length) where.serviceDate = dateRange;

  const bookings = await prisma.booking.findMany({
    where,
    include: { venue: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const now = new Date().getTime();
  const rows: BookingRow[] = bookings.map((b) => ({
    id: b.id,
    reference: b.reference,
    type: b.type,
    siteCode: b.siteCode,
    venueName: b.venue.name,
    dateDisplay: formatShortDate(b.serviceDate),
    window: formatWindow(b.slotStart, b.slotEnd),
    status: b.status,
    canCancel:
      ACTIVE_STATUSES.includes(b.status as BookingStatus) && b.slotStart.getTime() > now,
  }));

  const nav: NavItem[] = supplierNav("mine", t);

  return (
    <div style={{ minHeight: "100vh" }}>
      <TopBar user={user} lang={lang} t={t} nav={nav} />
      <main style={{ padding: 24, display: "flex", flexDirection: "column", gap: 22, maxWidth: 1320, margin: "0 auto" }}>
        <div
          style={{
            background: "#fff",
            border: "1px solid var(--border-card)",
            borderRadius: 9,
            padding: "10px 12px",
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <DateRangeFilter t={t} basePath="/supplier/bookings" />
        </div>
        <MyBookings t={t} rows={rows} />
      </main>
    </div>
  );
}
