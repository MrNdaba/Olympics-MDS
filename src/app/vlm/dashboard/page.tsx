import { requireRole } from "@/lib/auth";
import { getTranslations } from "@/lib/lang";
import { prisma } from "@/lib/db";
import { runLifecycleSweep } from "@/lib/booking";
import { getDaySlots } from "@/lib/slots";
import { addDays, dayIso, formatLongDate, hmOf, parseDakarDay } from "@/lib/time";
import { TopBar } from "@/components/TopBar";
import { Poller } from "@/components/Poller";
import { DashboardFilters } from "@/components/vlm/DashboardFilters";
import { adminNav, vlmNav } from "@/lib/nav";

// Shared Admin/VLM dashboard (admin/page.tsx redirects here — Register #5:
// admin has VLM rights across all venues). A "Du/Au" range drives everything;
// with no range in the URL it's exactly Today, and it always resets to Today
// on a fresh visit since state lives only in the query string (items #7/#8).
export default async function VlmDashboard({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; from?: string; to?: string; venueId?: string }>;
}) {
  const user = await requireRole("vlm", "admin");
  const { lang, t } = await getTranslations();
  const sp = await searchParams;

  await runLifecycleSweep();

  const scopedVenues =
    user.role === "admin"
      ? await prisma.venue.findMany({ orderBy: { name: "asc" } })
      : await prisma.venue.findMany({ where: { id: { in: user.venueIds } }, orderBy: { name: "asc" } });
  const scopedVenueIds = scopedVenues.map((v) => v.id);

  // Optional venue filter — the whole dashboard reflects the chosen venue, or all
  // scoped venues when none is selected (spec §4 keeps it within scope).
  const selectedVenueId =
    sp.venueId && scopedVenueIds.includes(sp.venueId) ? sp.venueId : "";
  const effectiveVenueIds = selectedVenueId ? [selectedVenueId] : scopedVenueIds;
  const primary = selectedVenueId
    ? scopedVenues.find((v) => v.id === selectedVenueId)!
    : scopedVenues[0];

  const todayIso = dayIso(new Date());
  const parsedFrom =
    sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from)
      ? parseDakarDay(sp.from)
      : sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date)
        ? parseDakarDay(sp.date)
        : parseDakarDay(todayIso);
  const parsedTo =
    sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to)
      ? parseDakarDay(sp.to)
      : sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date)
        ? parseDakarDay(sp.date)
        : parseDakarDay(todayIso);
  const fromDay = parsedFrom.getTime() <= parsedTo.getTime() ? parsedFrom : parsedTo;
  const toDay = parsedFrom.getTime() <= parsedTo.getTime() ? parsedTo : parsedFrom;
  const fromIso = dayIso(fromDay);
  const toIso = dayIso(toDay);
  const toExclusive = addDays(toDay, 1);
  const isSingleDay = fromIso === toIso;
  const rangeLabel = isSingleDay
    ? formatLongDate(fromDay, lang)
    : `${fromIso} → ${toIso}`;

  const rangeBookings = await prisma.booking.findMany({
    where: {
      venueId: { in: effectiveVenueIds },
      serviceDate: { gte: fromDay, lte: toDay },
    },
    include: {
      venue: { select: { name: true, siteCode: true } },
    },
  });
  const counts = {
    Confirmed: rangeBookings.filter((b) => b.status === "Confirmed").length,
    PendingValidation: rangeBookings.filter((b) => b.status === "PendingValidation").length,
    Cancelled: rangeBookings.filter((b) => b.status === "Cancelled").length,
    Expired: rangeBookings.filter((b) => b.status === "Expired").length,
  };
  const deliveries = rangeBookings.filter((b) => b.type === "delivery" && (b.status === "Confirmed" || b.status === "PendingValidation")).length;
  const collections = rangeBookings.filter((b) => b.type === "collection" && (b.status === "Confirmed" || b.status === "PendingValidation")).length;
  const activeTotal = deliveries + collections;

  const showSlotGrid = effectiveVenueIds.length === 1 && isSingleDay && primary;

  // Single-day, single-venue view keeps the per-slot load grid from the base dashboard.
  const grid = showSlotGrid && primary ? await getDaySlots(primary.id, fromDay) : { open: false, slots: [] };
  const holds = showSlotGrid && primary
    ? await prisma.slotHold.findMany({
        where: { venueId: primary.id, slotStart: { gte: fromDay, lt: toExclusive } },
        include: { booking: { select: { status: true } } },
      })
    : [];
  const holdByStart = new Map(holds.map((h) => [h.slotStart.getTime(), h.booking.status]));
  const loadCells = grid.slots.map((s) => {
    const status = holdByStart.get(s.start.getTime());
    const state = status === "Confirmed" ? "confirmed" : status === "PendingValidation" ? "pending" : "free";
    return { time: hmOf(s.start), state };
  });
  const bookedCount = loadCells.filter((c) => c.state !== "free").length;

  const dayBuckets = new Map<string, { confirmed: number; pending: number }>();
  for (let cursor = fromDay.getTime(); cursor <= toDay.getTime(); cursor = addDays(new Date(cursor), 1).getTime()) {
    dayBuckets.set(dayIso(new Date(cursor)), { confirmed: 0, pending: 0 });
  }
  for (const booking of rangeBookings) {
    const key = dayIso(booking.serviceDate as Date);
    const bucket = dayBuckets.get(key);
    if (!bucket) continue;
    if (booking.status === "Confirmed") bucket.confirmed += 1;
    if (booking.status === "PendingValidation") bucket.pending += 1;
  }
  const periodLoad = Array.from(dayBuckets.entries()).map(([iso, bucket]) => ({
    iso,
    ...bucket,
    total: bucket.confirmed + bucket.pending,
  }));
  const maxPeriodTotal = Math.max(...periodLoad.map((bucket) => bucket.total), 0);
  const todayDay = parseDakarDay(todayIso);
  const historicalOnly = toDay.getTime() < todayDay.getTime();
  const slotRows = Array.from(
    rangeBookings
      .filter((booking) => booking.serviceDate.getTime() >= todayDay.getTime())
      .reduce((map, booking) => {
        const key = [dayIso(booking.serviceDate), booking.venue.siteCode, hmOf(booking.slotStart), hmOf(booking.slotEnd)].join("|");
        const current = map.get(key) ?? {
          dateIso: dayIso(booking.serviceDate),
          venueLabel: `${booking.venue.name} (${booking.venue.siteCode})`,
          window: `${hmOf(booking.slotStart)} → ${hmOf(booking.slotEnd)}`,
          count: 0,
          active: 0,
        };
        current.count += 1;
        if (booking.status === "Confirmed" || booking.status === "PendingValidation") current.active += 1;
        map.set(key, current);
        return map;
      }, new Map<string, { dateIso: string; venueLabel: string; window: string; count: number; active: number }>())
      .values(),
  ).sort((a, b) => `${a.dateIso}${a.window}${a.venueLabel}`.localeCompare(`${b.dateIso}${b.window}${b.venueLabel}`));

  const navItems = user.role === "admin" ? adminNav("dashboard", t) : vlmNav("dashboard", t);
  const venueLabel =
    selectedVenueId
      ? scopedVenues.find((v) => v.id === selectedVenueId)?.name ?? t.all
      : scopedVenues.length === 1
        ? scopedVenues[0]?.name ?? t.all
        : t.all;

  const listQs = new URLSearchParams();
  listQs.set("from", fromIso);
  listQs.set("to", toIso);
  if (selectedVenueId) listQs.set("venueId", selectedVenueId);
  const listHref = `/vlm/daily?${listQs.toString()}`;
  const exportBase = listQs.toString();

  const statusCard = (count: number, label: string, color: string) => (
    <div style={{ background: "#fff", borderRadius: 10, padding: "16px 18px", borderLeft: `3px solid ${color}`, border: "1px solid var(--border-card)" }}>
      <div style={{ fontSize: 28, fontWeight: 800 }}>{count}</div>
      <div style={{ fontSize: 11.5, fontWeight: 600, color }}>{label}</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh" }}>
      <TopBar user={user} lang={lang} t={t} nav={navItems} subtitle={venueLabel} liveBadge />
      <Poller />
      <main style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18, maxWidth: 1360, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "space-between", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700 }}>{rangeLabel}</h1>
            <p style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 4 }}>
              {venueLabel}
            </p>
          </div>
          <DashboardFilters
            t={t}
            venues={scopedVenues.map((v) => ({ id: v.id, name: v.name, siteCode: v.siteCode }))}
            selectedVenueId={selectedVenueId}
            from={fromIso}
            to={toIso}
            today={todayIso}
          />
          <a
            href={listHref}
            style={{ marginLeft: "auto", background: "var(--blue)", color: "#fff", borderRadius: 7, padding: "8px 14px", fontSize: 12.5, fontWeight: 600 }}
          >
            ⎙ {t.printDaily}
          </a>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {statusCard(counts.Confirmed, t.stConfirmedPl, "var(--st-confirmed)")}
          {statusCard(counts.PendingValidation, t.stPendingPl, "var(--st-pending)")}
          {statusCard(counts.Cancelled, t.stCancelledPl, "var(--st-cancelled)")}
          {statusCard(counts.Expired, t.stExpiredPl, "var(--st-expired)")}
        </div>

        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700 }}>
              {t.loadTitle} — {showSlotGrid ? primary?.name ?? "—" : venueLabel}
            </h2>
            {showSlotGrid ? (
              <span className="mono" style={{ fontSize: 11, color: "#5A6B7C" }}>
                {bookedCount} / {loadCells.length}
              </span>
            ) : (
              <span className="mono" style={{ fontSize: 11, color: "#5A6B7C" }}>
                {periodLoad.reduce((sum, bucket) => sum + bucket.total, 0)}
              </span>
            )}
          </div>
          {showSlotGrid && !grid.open ? (
            <p style={{ fontSize: 12, color: "#9AA7B2" }}>{t.closedDay}</p>
          ) : showSlotGrid ? (
            <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
              {loadCells.map((c, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <div
                    title={c.time}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 4,
                      background:
                        c.state === "confirmed" ? "var(--blue)" : c.state === "pending" ? "var(--st-pending-cell)" : "#E3E9EF",
                    }}
                  />
                  <span className="mono" style={{ fontSize: 8.5, color: "#5A6B7C" }}>{c.time}</span>
                </div>
              ))}
            </div>
          ) : periodLoad.length === 0 ? (
            <p style={{ fontSize: 12, color: "#9AA7B2" }}>{t.noBookings}</p>
          ) : (
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end", overflowX: "auto", paddingBottom: 4 }}>
              {periodLoad.map((bucket) => {
                const totalHeight = maxPeriodTotal ? Math.max(18, (bucket.total / maxPeriodTotal) * 110) : 18;
                const pendingHeight = bucket.total ? (bucket.pending / bucket.total) * totalHeight : 0;
                const confirmedHeight = totalHeight - pendingHeight;
                return (
                  <div key={bucket.iso} style={{ minWidth: 50, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <div className="mono" style={{ fontSize: 10, color: "#5A6B7C" }}>{bucket.total}</div>
                    <div style={{ width: 26, height: 116, display: "flex", alignItems: "flex-end" }}>
                      <div style={{ width: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", borderRadius: 6, overflow: "hidden", background: "#E3E9EF" }}>
                        {bucket.pending > 0 && <div style={{ height: pendingHeight, background: "var(--st-pending-cell)" }} />}
                        {bucket.confirmed > 0 && <div style={{ height: confirmedHeight, background: "var(--blue)" }} />}
                      </div>
                    </div>
                    <span className="mono" style={{ fontSize: 9, color: "#5A6B7C" }}>{bucket.iso.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 10.5, color: "#5A6B7C" }}>
            <Legend color="var(--blue)" label={t.legBooked} />
            <Legend color="var(--st-pending-cell)" label={t.legPendingSlot} />
            {showSlotGrid && <Legend color="#E3E9EF" label={t.legFree} />}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <div style={cardStyle}>
            <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{t.typeSplit}</h2>
            <div style={{ height: 14, borderRadius: 7, overflow: "hidden", display: "flex", background: "#EBF0F4" }}>
              <div style={{ width: `${activeTotal ? (deliveries / activeTotal) * 100 : 0}%`, background: "var(--blue)" }} />
              <div style={{ width: `${activeTotal ? (collections / activeTotal) * 100 : 0}%`, background: "#12202E" }} />
            </div>
            <div style={{ display: "flex", gap: 18, marginTop: 10, fontSize: 12 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--blue)" }} />
                {t.deliveriesPl} <b className="mono">{deliveries}</b>
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: "#12202E" }} />
                {t.collectionsPl} <b className="mono">{collections}</b>
              </span>
            </div>
          </div>

          <div style={cardStyle}>
            <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{t.dailyList}</h2>
            <p style={{ fontSize: 11.5, color: "#5A6B7C", marginBottom: 12, lineHeight: 1.45 }}>{t.dailyListNote}</p>
            <div style={{ display: "flex", gap: 8 }}>
              <a
                href={`${listHref}`}
                style={{ border: "1px solid #C7D1DA", borderRadius: 7, padding: "8px 12px", fontSize: 12, fontWeight: 600, color: "#33475B", display: "inline-block" }}
              >
                ⎙ {t.printDaily}
              </a>
              <a
                href={`/vlm/export?format=xlsx&${exportBase}`}
                style={{ border: "1px solid #C7D1DA", borderRadius: 7, padding: "8px 12px", fontSize: 12, fontWeight: 600, color: "#33475B", display: "inline-block" }}
              >
                Excel ↓
              </a>
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
            {historicalOnly ? t.bookingTotalsByDay : t.slotLevelDetails}
          </h2>
          {historicalOnly ? (
            periodLoad.length === 0 ? (
              <p style={{ fontSize: 12, color: "#9AA7B2" }}>{t.noBookings}</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={tableHead}>{t.colDate}</th>
                    <th style={tableHead}>{t.total}</th>
                    <th style={tableHead}>{t.stConfirmedPl}</th>
                    <th style={tableHead}>{t.stPendingPl}</th>
                  </tr>
                </thead>
                <tbody>
                  {periodLoad.map((bucket) => (
                    <tr key={bucket.iso}>
                      <td style={tableCell}>{bucket.iso}</td>
                      <td style={tableCell}>{bucket.total}</td>
                      <td style={tableCell}>{bucket.confirmed}</td>
                      <td style={tableCell}>{bucket.pending}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : slotRows.length === 0 ? (
            <p style={{ fontSize: 12, color: "#9AA7B2" }}>{t.noBookings}</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={tableHead}>{t.colDate}</th>
                  <th style={tableHead}>{t.colVenue}</th>
                  <th style={tableHead}>{t.colWindow}</th>
                  <th style={tableHead}>{t.slotBookingCount}</th>
                  <th style={tableHead}>{t.activeSlotCount}</th>
                </tr>
              </thead>
              <tbody>
                {slotRows.map((row) => (
                  <tr key={`${row.dateIso}-${row.venueLabel}-${row.window}`}>
                    <td style={tableCell}>{row.dateIso}</td>
                    <td style={tableCell}>{row.venueLabel}</td>
                    <td style={tableCell}>{row.window}</td>
                    <td style={tableCell}>{row.count}</td>
                    <td style={tableCell}>{row.active}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid var(--border-card)",
  borderRadius: 10,
  padding: "16px 18px",
};

const tableHead: React.CSSProperties = {
  textAlign: "left",
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: ".05em",
  color: "#5A6B7C",
  padding: "0 0 10px",
};

const tableCell: React.CSSProperties = {
  padding: "10px 0",
  fontSize: 12,
  borderTop: "1px solid #F0F3F6",
};

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 10, height: 10, background: color, borderRadius: 3 }} />
      {label}
    </span>
  );
}
