import { requireRole } from "@/lib/auth";
import { getTranslations } from "@/lib/lang";
import { prisma } from "@/lib/db";
import { getActiveVenues } from "@/lib/venues";
import { ACTIVE_STATUSES, type BookingStatus } from "@/lib/constants";
import { formatShortDate, formatWindow, parseDakarDay } from "@/lib/time";
import { TopBar, type NavItem } from "@/components/TopBar";
import { MyBookings, type BookingRow } from "@/components/MyBookings";
import { FilterBar } from "@/components/FilterBar";
import { supplierNav } from "@/lib/nav";

export default async function SupplierBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    type?: string;
    venueId?: string;
    from?: string;
    to?: string;
    sort?: string;
  }>;
}) {
  const user = await requireRole("supplier");
  const { lang, t } = await getTranslations();
  const sp = await searchParams;

  // Status/Venue/Type filter + reference search (item #1) — the exact same
  // FilterBar the VLM bookings screen uses, scoped to this supplier's own
  // bookings only. Same standard date-range filter as the VLM/Admin views
  // (serviceDate, Dakar-local day bounds).
  const venues = await getActiveVenues();
  const where: Record<string, unknown> = { createdById: user.id };
  if (sp.status) where.status = sp.status;
  if (sp.type) where.type = sp.type;
  if (sp.venueId) where.venueId = sp.venueId;
  if (sp.q) where.reference = { contains: sp.q };
  const dateRange: Record<string, Date> = {};
  if (sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from)) dateRange.gte = parseDakarDay(sp.from);
  if (sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to)) dateRange.lte = parseDakarDay(sp.to);
  if (Object.keys(dateRange).length) where.serviceDate = dateRange;

  // Newest ⇄ Oldest sort (item #10) — newest first by default.
  const bookings = await prisma.booking.findMany({
    where,
    include: {
      venue: true,
      // Latest cancellation reason, if any, for the status-badge tooltip (item #5).
      auditEntries: { where: { action: "cancelled" }, orderBy: { timestamp: "desc" }, take: 1 },
    },
    orderBy: { createdAt: sp.sort === "oldest" ? "asc" : "desc" },
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
    cancelReason: b.auditEntries[0]?.reason ?? null,
  }));

  const nav: NavItem[] = supplierNav("mine", t);

  return (
    <div style={{ minHeight: "100vh" }}>
      <TopBar user={user} lang={lang} t={t} nav={nav} />
      <main style={{ padding: 24, display: "flex", flexDirection: "column", gap: 22, maxWidth: 1320, margin: "0 auto" }}>
        <FilterBar t={t} venues={venues} basePath="/supplier/bookings" searchPlaceholder={t.fSearchRef} />
        <MyBookings t={t} rows={rows} />
      </main>
    </div>
  );
}
