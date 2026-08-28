import { requireRole } from "@/lib/auth";
import { getTranslations } from "@/lib/lang";
import { prisma } from "@/lib/db";
import { runLifecycleSweep } from "@/lib/booking";
import { ACTIVE_STATUSES, type BookingStatus } from "@/lib/constants";
import { formatShortDate, formatWindow, parseDakarDay } from "@/lib/time";
import { TopBar, type NavItem } from "@/components/TopBar";
import { FilterBar } from "@/components/FilterBar";
import { VlmBookingsTable, type VlmRow } from "@/components/VlmBookingsTable";
import { adminNav, vlmNav } from "@/lib/nav";

export default async function VlmPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; type?: string; venueId?: string; from?: string; to?: string; sort?: string }>;
}) {
  // View Only accounts see this list read-only (item #3) — allowed here, but
  // deliberately excluded from vlm/actions.ts so every mutation is blocked
  // server-side regardless of what the client renders.
  const user = await requireRole("vlm", "admin", "viewer");
  const { lang, t } = await getTranslations();
  const sp = await searchParams;

  // Time-driven lifecycle transitions run on load (spec §12/§16 polling baseline).
  await runLifecycleSweep();

  // Server-side venue scoping (spec §4): VLM limited to assigned venues.
  const scopedVenues =
    user.role === "admin"
      ? await prisma.venue.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, siteCode: true } })
      : await prisma.venue.findMany({ where: { id: { in: user.venueIds } }, orderBy: { name: "asc" }, select: { id: true, name: true, siteCode: true } });
  const scopedVenueIds = scopedVenues.map((v) => v.id);

  // Optional venue filter — must stay within the user's scope.
  const selectedVenueId =
    sp.venueId && scopedVenueIds.includes(sp.venueId) ? sp.venueId : undefined;

  const where: Record<string, unknown> = {
    venueId: selectedVenueId ? selectedVenueId : { in: scopedVenueIds },
  };
  if (sp.status) where.status = sp.status;
  if (sp.type) where.type = sp.type;
  const dateRange: Record<string, Date> = {};
  if (sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from)) dateRange.gte = parseDakarDay(sp.from);
  if (sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to)) dateRange.lte = parseDakarDay(sp.to);
  if (Object.keys(dateRange).length) where.serviceDate = dateRange;
  if (sp.q) {
    where.OR = [
      { reference: { contains: sp.q } },
      { supplierName: { contains: sp.q } },
      { transporterName: { contains: sp.q } },
    ];
  }

  // Newest ⇄ Oldest sort (item #10) overrides the default upcoming-first
  // ordering only once the VLM explicitly picks it via SortControl.
  const orderBy =
    sp.sort === "newest"
      ? [{ createdAt: "desc" as const }]
      : sp.sort === "oldest"
        ? [{ createdAt: "asc" as const }]
        : [{ serviceDate: "asc" as const }, { slotStart: "asc" as const }];

  const [bookings, pendingCount] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: {
        compound: true,
        gate: true,
        venue: true,
        // Latest cancellation reason, if any, for the status-badge tooltip (item #5).
        auditEntries: { where: { action: "cancelled" }, orderBy: { timestamp: "desc" }, take: 1 },
      },
      orderBy,
      take: 200,
    }),
    prisma.booking.count({ where: { venueId: { in: scopedVenueIds }, status: "PendingValidation" } }),
  ]);

  const now = new Date().getTime();
  const rows: VlmRow[] = bookings.map((b) => ({
    id: b.id,
    reference: b.reference,
    type: b.type,
    window: formatWindow(b.slotStart, b.slotEnd),
    dateDisplay: formatShortDate(b.serviceDate),
    venueName: `${b.venue.name} (${b.venue.siteCode})`,
    supplierName: b.supplierName,
    transporterName: b.transporterName,
    compoundLabel: b.compound.label,
    gateLabel: b.gate.label,
    status: b.status,
    canValidate: b.status === "PendingValidation",
    canCancel: ACTIVE_STATUSES.includes(b.status as BookingStatus) && b.slotStart.getTime() > now,
    canReinstate: b.status === "Cancelled" && b.slotStart.getTime() > now,
    cancelReason: b.auditEntries[0]?.reason ?? null,
  }));

  const venueLabel =
    selectedVenueId
      ? scopedVenues.find((v) => v.id === selectedVenueId)?.name ?? t.all
      : scopedVenues.length === 1
        ? scopedVenues[0].name
        : t.all;
  const nav: NavItem[] =
    user.role === "admin" ? adminNav("bookings", t) : vlmNav("bookings", t);

  // Carry the active filters into the exports so they mirror the on-screen list (§17).
  const exportParams = new URLSearchParams();
  if (sp.q) exportParams.set("q", sp.q);
  if (sp.status) exportParams.set("status", sp.status);
  if (sp.type) exportParams.set("type", sp.type);
  if (selectedVenueId) exportParams.set("venueId", selectedVenueId);
  if (sp.from) exportParams.set("from", sp.from);
  if (sp.to) exportParams.set("to", sp.to);
  if (sp.sort) exportParams.set("sort", sp.sort);
  const exportQs = exportParams.toString();
  const suffix = exportQs ? `&${exportQs}` : "";
  const dailyQs = exportParams.toString();

  return (
    <div style={{ minHeight: "100vh" }}>
      <TopBar user={user} lang={lang} t={t} nav={nav} subtitle={venueLabel} />
      <main style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, maxWidth: 1360, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700 }}>
              {t.vlmTitle} — {venueLabel}
            </h1>
            <p style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>{t.vlmSub}</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <a
              href={`/vlm/daily${dailyQs ? `?${dailyQs}` : ""}`}
              style={{ border: "1px solid #C7D1DA", borderRadius: 7, padding: "8px 12px", fontSize: 12, fontWeight: 600, color: "#33475B", background: "#fff" }}
            >
              ⎙ {t.dailyList}
            </a>
            <a
              href={`/vlm/export?format=csv${suffix}`}
              style={{ border: "1px solid #C7D1DA", borderRadius: 7, padding: "8px 12px", fontSize: 12, fontWeight: 600, color: "#33475B", background: "#fff" }}
            >
              Excel ↓
            </a>
            <a
              href={`/vlm/export?format=pdf${suffix}`}
              style={{ border: "1px solid #C7D1DA", borderRadius: 7, padding: "8px 12px", fontSize: 12, fontWeight: 600, color: "#33475B", background: "#fff" }}
            >
              PDF ↓
            </a>
          </div>
        </div>
        <FilterBar t={t} pendingCount={pendingCount} venues={scopedVenues} />
        <VlmBookingsTable t={t} rows={rows} readOnly={user.role === "viewer"} />
      </main>
    </div>
  );
}
