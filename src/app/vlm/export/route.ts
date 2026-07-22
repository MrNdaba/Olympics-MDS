import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { prisma } from "@/lib/db";
import { formatShortDate, formatWindow, parseDakarDay } from "@/lib/time";
import { getDict } from "@/lib/i18n";
import { buildBookingListPdf, type BookingListRow } from "@/lib/pdf";

// Filtered booking-list export to Excel (CSV) and PDF (spec §17). Honours the
// same filters as the VLM list (venue scope, status, type, date, free-text) and
// keeps "booking type" as a prominent labelled column.
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user || (user.role !== "vlm" && user.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "pdf" ? "pdf" : "csv";
  const status = url.searchParams.get("status") ?? undefined;
  const type = url.searchParams.get("type") ?? undefined;
  const venueId = url.searchParams.get("venueId") ?? undefined;
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  const q = url.searchParams.get("q") ?? undefined;

  // Server-side venue scoping (spec §4): VLM limited to assigned venues.
  const scopedVenueIds =
    user.role === "admin"
      ? (await prisma.venue.findMany({ select: { id: true } })).map((v) => v.id)
      : user.venueIds;

  const selectedVenueId = venueId && scopedVenueIds.includes(venueId) ? venueId : undefined;

  const where: Record<string, unknown> = {
    venueId: selectedVenueId ? selectedVenueId : { in: scopedVenueIds },
  };
  if (status) where.status = status;
  if (type) where.type = type;
  const dateRange: Record<string, Date> = {};
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) dateRange.gte = parseDakarDay(from);
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) dateRange.lte = parseDakarDay(to);
  if (Object.keys(dateRange).length) where.serviceDate = dateRange;
  if (q) {
    where.OR = [
      { reference: { contains: q } },
      { supplierName: { contains: q } },
      { transporterName: { contains: q } },
    ];
  }

  const bookings = await prisma.booking.findMany({
    where,
    include: { venue: true, compound: true, gate: true },
    orderBy: [{ serviceDate: "asc" }, { slotStart: "asc" }],
  });

  const lang = await getLang();
  const t = getDict(lang);
  const typeLabel = (v: string) => (v === "delivery" ? t.delivery : t.collection);
  const statusLabel = (v: string) =>
    v === "Confirmed"
      ? t.stConfirmed
      : v === "PendingValidation"
        ? t.stPending
        : v === "Cancelled"
          ? t.stCancelled
          : t.stExpired;

  if (format === "pdf") {
    const rows: BookingListRow[] = bookings.map((b) => ({
      reference: b.reference,
      bookingType: typeLabel(b.type),
      company: b.supplierName,
      date: formatShortDate(b.serviceDate),
      window: formatWindow(b.slotStart, b.slotEnd),
      venue: `${b.venue.name} (${b.siteCode})`,
      transporter: b.transporterName,
      transporterContact: b.transporterContact,
      compound: b.compound.label,
      gate: b.gate.label,
      vehicleType: b.vehicleType,
      merchandiseType: b.merchandiseType,
      status: statusLabel(b.status),
    }));
    const rangeLabel =
      from || to
        ? ` · ${from ? formatShortDate(parseDakarDay(from)) : "…"} → ${to ? formatShortDate(parseDakarDay(to)) : "…"}`
        : "";
    const bytes = await buildBookingListPdf(
      rows,
      {
        title: t.exportTitle,
        subtitle: `${bookings.length} ${t.exportResults}${rangeLabel}`,
        generatedAt: new Date(),
      },
      lang,
    );
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="mds-bookings-${Date.now()}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const headers = [
    t.colRef,
    t.colType,
    t.colSupplier,
    t.date,
    t.colWindow,
    t.venue,
    t.colTransporter,
    t.transporterPhone,
    t.compound,
    t.gate,
    t.vehicleType,
    t.merchType,
    t.colStatus,
  ];
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = bookings.map((b) =>
    [
      b.reference,
      typeLabel(b.type),
      b.supplierName,
      formatShortDate(b.serviceDate),
      formatWindow(b.slotStart, b.slotEnd),
      `${b.venue.name} (${b.siteCode})`,
      b.transporterName,
      b.transporterContact,
      b.compound.label,
      b.gate.label,
      b.vehicleType,
      b.merchandiseType,
      statusLabel(b.status),
    ]
      .map(esc)
      .join(","),
  );
  const csv = "\uFEFF" + [headers.map(esc).join(","), ...lines].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mds-bookings-${Date.now()}.csv"`,
    },
  });
}
