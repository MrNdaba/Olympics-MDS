import Image from "next/image";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getTranslations } from "@/lib/lang";
import { prisma } from "@/lib/db";
import { runLifecycleSweep } from "@/lib/booking";
import { formatLongDate, formatShortDate, formatWindow, parseDakarDay } from "@/lib/time";
import { PrintButton } from "@/components/PrintButton";
import { TypeChip } from "@/components/Chips";

export default async function DailyListPage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    venueId?: string;
    from?: string;
    to?: string;
    status?: string;
    type?: string;
    q?: string;
  }>;
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

  // A single ?date= (from the dashboard) maps to a one-day range.
  const from = sp.from ?? sp.date;
  const to = sp.to ?? sp.date;

  // Server-side scope enforcement (spec §4): venue filter must stay in scope.
  const selectedVenueId =
    sp.venueId && scopedVenueIds.includes(sp.venueId) ? sp.venueId : undefined;

  const where: Record<string, unknown> = {
    venueId: selectedVenueId ? selectedVenueId : { in: scopedVenueIds },
    // Gate-operator document: default to the operationally relevant statuses,
    // but honour an explicit status filter so the list mirrors the bookings table.
    status: sp.status ? sp.status : { in: ["Confirmed", "PendingValidation"] },
  };
  if (sp.type) where.type = sp.type;
  const dateRange: Record<string, Date> = {};
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) dateRange.gte = parseDakarDay(from);
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) dateRange.lte = parseDakarDay(to);
  if (Object.keys(dateRange).length) where.serviceDate = dateRange;
  if (sp.q) {
    where.OR = [
      { reference: { contains: sp.q } },
      { supplierName: { contains: sp.q } },
      { transporterName: { contains: sp.q } },
    ];
  }

  const bookings = await prisma.booking.findMany({
    where,
    include: { compound: true, gate: true, venue: true },
    orderBy: [{ serviceDate: "asc" }, { slotStart: "asc" }],
  });

  const th: React.CSSProperties = {
    textAlign: "left",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: ".05em",
    color: "#5A6B7C",
    padding: "8px 10px",
    borderBottom: "2px solid #12202E",
  };
  const td: React.CSSProperties = { padding: "8px 10px", fontSize: 11.5, borderBottom: "1px solid #E3E9EF", verticalAlign: "top" };
  const mono: React.CSSProperties = { fontFamily: "var(--font-mono)" };

  const selVenue = selectedVenueId ? scopedVenues.find((v) => v.id === selectedVenueId) : undefined;
  const venueLabel = selVenue ? `${selVenue.name} · ${selVenue.siteCode}` : t.all;
  const rangeLabel =
    from && to && from === to
      ? formatLongDate(parseDakarDay(from), lang)
      : `${from ? formatShortDate(parseDakarDay(from)) : "…"} → ${to ? formatShortDate(parseDakarDay(to)) : "…"}`;

  // Carry filters into the back link and the downloadable PDF.
  const qs = new URLSearchParams();
  if (sp.q) qs.set("q", sp.q);
  if (sp.status) qs.set("status", sp.status);
  if (sp.type) qs.set("type", sp.type);
  if (selectedVenueId) qs.set("venueId", selectedVenueId);
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  const pdfHref = `/vlm/export?format=pdf${qs.toString() ? `&${qs.toString()}` : ""}`;
  const backHref = "/vlm" + (qs.toString() ? `?${qs.toString()}` : "");

  return (
    <div style={{ minHeight: "100vh", background: "#fff" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: 28 }}>
        {/* Toolbar (hidden when printing) */}
        <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <Link href={backHref} style={{ color: "var(--blue)", fontWeight: 600, fontSize: 13 }}>← {t.back}</Link>
          <div style={{ display: "flex", gap: 10 }}>
            <a
              href={pdfHref}
              style={{ border: "1px solid #C7D1DA", borderRadius: 7, padding: "8px 14px", fontSize: 12.5, fontWeight: 600, color: "#33475B" }}
            >
              PDF ↓
            </a>
            <PrintButton label={t.print} filled />
          </div>
        </div>

        {/* Printable header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "3px solid var(--blue)", paddingBottom: 14, marginBottom: 6 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800 }}>{t.dailyListTitle}</h1>
            <p style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>{venueLabel}</p>
            <p className="mono" style={{ fontSize: 12, color: "#5A6B7C", marginTop: 2 }}>{rangeLabel}</p>
          </div>
          <Image src="/dakar2026-logo.png" alt="Dakar 2026" width={110} height={46} style={{ height: 46, width: "auto" }} />
        </div>
        <p style={{ fontSize: 10.5, color: "#9AA7B2", marginBottom: 16 }}>{t.gateOperatorsNote}</p>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>{t.colDate}</th>
              <th style={th}>{t.colWindow}</th>
              <th style={th}>{t.colRef}</th>
              <th style={th}>{t.colType}</th>
              <th style={th}>{t.colVenue}</th>
              <th style={th}>{t.colSupplier}</th>
              <th style={th}>{t.colTransporter}</th>
              <th style={th}>{t.compound}</th>
              <th style={th}>{t.gate}</th>
              <th style={th}>{t.vehicleType}</th>
              <th style={th}>{t.colStatus}</th>
            </tr>
          </thead>
          <tbody>
            {bookings.length === 0 && (
              <tr><td style={{ ...td, color: "#9AA7B2" }} colSpan={11}>{t.noBookings}</td></tr>
            )}
            {bookings.map((b) => (
              <tr key={b.id}>
                <td style={{ ...td, ...mono }}>{formatShortDate(b.serviceDate)}</td>
                <td style={{ ...td, ...mono, fontWeight: 600 }}>{formatWindow(b.slotStart, b.slotEnd)}</td>
                <td style={{ ...td, ...mono }}>{b.reference}</td>
                <td style={td}><TypeChip type={b.type} t={t} /></td>
                <td style={td}>{b.venue.name} <span className="mono" style={{ color: "#5A6B7C" }}>({b.venue.siteCode})</span></td>
                <td style={td}>{b.supplierName}</td>
                <td style={td}>
                  {b.transporterName}
                  <div className="mono" style={{ fontSize: 10, color: "#5A6B7C" }}>{b.transporterContact}</div>
                </td>
                <td style={td}>{b.compound.label}</td>
                <td style={td}>{b.gate.label}</td>
                <td style={td}>{b.vehicleType}</td>
                <td style={td}>{b.status === "Confirmed" ? t.stConfirmed : t.stPending}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mono" style={{ fontSize: 10, color: "#9AA7B2", marginTop: 18 }}>
          {bookings.length} · {t.loginFooter}
        </p>
      </div>
    </div>
  );
}
