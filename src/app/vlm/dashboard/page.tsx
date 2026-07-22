import { requireRole } from "@/lib/auth";
import { getTranslations } from "@/lib/lang";
import { prisma } from "@/lib/db";
import { runLifecycleSweep } from "@/lib/booking";
import { getDaySlots } from "@/lib/slots";
import { addDays, dayIso, formatLongDate, hmOf, parseDakarDay } from "@/lib/time";
import { TopBar } from "@/components/TopBar";
import { Poller } from "@/components/Poller";
import { DashboardVenueSelect } from "@/components/vlm/VenueSelect";
import { adminNav, vlmNav } from "@/lib/nav";

export default async function VlmDashboard({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; venueId?: string }>;
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

  const day = sp.date ? parseDakarDay(sp.date) : parseDakarDay(dayIso(new Date()));
  const dayEnd = addDays(day, 1);

  const dayBookings = await prisma.booking.findMany({
    where: { venueId: { in: effectiveVenueIds }, serviceDate: day },
    select: { status: true, type: true },
  });
  const counts = {
    Confirmed: dayBookings.filter((b) => b.status === "Confirmed").length,
    PendingValidation: dayBookings.filter((b) => b.status === "PendingValidation").length,
    Cancelled: dayBookings.filter((b) => b.status === "Cancelled").length,
    Expired: dayBookings.filter((b) => b.status === "Expired").length,
  };
  const deliveries = dayBookings.filter((b) => b.type === "delivery" && (b.status === "Confirmed" || b.status === "PendingValidation")).length;
  const collections = dayBookings.filter((b) => b.type === "collection" && (b.status === "Confirmed" || b.status === "PendingValidation")).length;
  const activeTotal = deliveries + collections;

  // Venue load per slot for the primary venue.
  const grid = primary ? await getDaySlots(primary.id, day) : { open: false, slots: [] };
  const holds = primary
    ? await prisma.slotHold.findMany({
        where: { venueId: primary.id, slotStart: { gte: day, lt: dayEnd } },
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

  const navItems = user.role === "admin" ? adminNav("dashboard", t) : vlmNav("dashboard", t);

  const statusCard = (count: number, label: string, color: string) => (
    <div style={{ background: "#fff", borderRadius: 10, padding: "16px 18px", borderLeft: `3px solid ${color}`, border: "1px solid var(--border-card)" }}>
      <div style={{ fontSize: 28, fontWeight: 800 }}>{count}</div>
      <div style={{ fontSize: 11.5, fontWeight: 600, color }}>{label}</div>
    </div>
  );

  const prevIso = dayIso(addDays(day, -1));
  const nextIso = dayIso(addDays(day, 1));
  const venueSuffix = selectedVenueId ? `&venueId=${selectedVenueId}` : "";
  const venueOnly = selectedVenueId ? `?venueId=${selectedVenueId}` : "";

  return (
    <div style={{ minHeight: "100vh" }}>
      <TopBar user={user} lang={lang} t={t} nav={navItems} subtitle={primary?.name ?? t.all} liveBadge />
      <Poller />
      <main style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18, maxWidth: 1360, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a href={`/vlm/dashboard?date=${prevIso}${venueSuffix}`} style={sqBtn}>‹</a>
          <a href={`/vlm/dashboard?date=${nextIso}${venueSuffix}`} style={sqBtn}>›</a>
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>{formatLongDate(day, lang)}</h1>
          <a href={`/vlm/dashboard${venueOnly}`} style={{ ...sqBtn, width: "auto", padding: "0 12px", color: "var(--blue)", fontWeight: 600, fontSize: 12 }}>
            {t.today}
          </a>
          {scopedVenues.length > 1 && (
            <DashboardVenueSelect
              venues={scopedVenues.map((v) => ({ id: v.id, name: v.name, siteCode: v.siteCode }))}
              selected={selectedVenueId}
              allLabel={`${t.fVenue}: ${t.all}`}
            />
          )}
          <a
            href={`/vlm/daily?date=${dayIso(day)}${venueSuffix}`}
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
              {t.loadTitle} — {primary?.name ?? "—"}
            </h2>
            <span className="mono" style={{ fontSize: 11, color: "#5A6B7C" }}>
              {bookedCount} / {loadCells.length}
            </span>
          </div>
          {!grid.open ? (
            <p style={{ fontSize: 12, color: "#9AA7B2" }}>{t.closedDay}</p>
          ) : (
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
          )}
          <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 10.5, color: "#5A6B7C" }}>
            <Legend color="var(--blue)" label={t.legBooked} />
            <Legend color="var(--st-pending-cell)" label={t.legPendingSlot} />
            <Legend color="#E3E9EF" label={t.legFree} />
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
                href={`/vlm/daily?date=${dayIso(day)}${venueSuffix}`}
                style={{ border: "1px solid #C7D1DA", borderRadius: 7, padding: "8px 12px", fontSize: 12, fontWeight: 600, color: "#33475B", display: "inline-block" }}
              >
                ⎙ PDF
              </a>
              <a
                href={`/vlm/export?format=csv&from=${dayIso(day)}&to=${dayIso(day)}${venueSuffix}`}
                style={{ border: "1px solid #C7D1DA", borderRadius: 7, padding: "8px 12px", fontSize: 12, fontWeight: 600, color: "#33475B", display: "inline-block" }}
              >
                Excel ↓
              </a>
            </div>
          </div>
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
const sqBtn: React.CSSProperties = {
  width: 30,
  height: 30,
  border: "1px solid #C7D1DA",
  borderRadius: 7,
  display: "inline-grid",
  placeItems: "center",
  background: "#fff",
  color: "#33475B",
};

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 10, height: 10, background: color, borderRadius: 3 }} />
      {label}
    </span>
  );
}
