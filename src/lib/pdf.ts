import { readFileSync } from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { getDict, type Lang } from "./i18n";
import { formatLongDate, hmOf } from "./time";
import type { BookingStatus } from "./constants";

export interface ConfirmationData {
  reference: string;
  type: "delivery" | "collection";
  status: BookingStatus;
  siteCode: string;
  venueName: string;
  compoundLabel: string;
  gateLabel: string;
  serviceDate: Date;
  slotStart: Date;
  slotEnd: Date;
  supplierName: string;
  supplierContact?: string | null;
  transporterName: string;
  transporterContact: string;
  vehicleType: string;
  merchandiseType: string;
  packagingType?: string | null;
  quantity?: string | null;
  weightKg?: number | null;
  volumeM3?: number | null;
  comments?: string | null;
  createdAt: Date;
}

const BLUE = rgb(0, 120 / 255, 208 / 255);
const INK = rgb(18 / 255, 32 / 255, 46 / 255);
const GRAY = rgb(90 / 255, 107 / 255, 124 / 255);
const LINE = rgb(0.87, 0.89, 0.92);

const STATUS_LABEL: Record<BookingStatus, "stConfirmed" | "stPending" | "stCancelled" | "stExpired"> = {
  Confirmed: "stConfirmed",
  PendingValidation: "stPending",
  Cancelled: "stCancelled",
  Expired: "stExpired",
};

// pdf-lib's standard fonts (Helvetica, Courier) only support WinAnsi
// (Latin-1 + CP1252 extras) encoding. Most accented/typographic characters
// used across the app are fine, but a few — most notably the "→" used
// everywhere a merged slot window is rendered ("10:00 → 11:30", spec §9) —
// are not, and pdf-lib throws synchronously the moment such a character is
// measured or drawn. That crashed every PDF export that included a slot
// window. Known offenders get a readable substitute; anything else
// unencodable is dropped rather than allowed to blow up the whole export.
const PDF_CHAR_REPLACEMENTS: Record<string, string> = {
  "→": "->",
  "←": "<-",
  "⇒": "=>",
  "⇐": "<=",
};

function makePdfSafe(font: PDFFont) {
  const cache = new Map<string, string>();
  return function pdfSafe(value: string): string {
    const cached = cache.get(value);
    if (cached !== undefined) return cached;
    let safeValue = value;
    try {
      font.widthOfTextAtSize(value, 1);
    } catch {
      safeValue = Array.from(value)
        .map((ch) => {
          if (ch in PDF_CHAR_REPLACEMENTS) return PDF_CHAR_REPLACEMENTS[ch];
          try {
            font.widthOfTextAtSize(ch, 1);
            return ch;
          } catch {
            return "?";
          }
        })
        .join("");
    }
    cache.set(value, safeValue);
    return safeValue;
  };
}

/** Build the branded booking-confirmation PDF (spec §14 field set). */
export async function buildConfirmationPdf(data: ConfirmationData, lang: Lang): Promise<Uint8Array> {
  const t = getDict(lang);
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4 portrait
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.Courier);
  const monoBold = await pdf.embedFont(StandardFonts.CourierBold);

  const safe = makePdfSafe(font);
  data = {
    ...data,
    venueName: safe(data.venueName),
    compoundLabel: safe(data.compoundLabel),
    gateLabel: safe(data.gateLabel),
    supplierName: safe(data.supplierName),
    supplierContact: data.supplierContact ? safe(data.supplierContact) : data.supplierContact,
    transporterName: safe(data.transporterName),
    transporterContact: safe(data.transporterContact),
    vehicleType: safe(data.vehicleType),
    merchandiseType: safe(data.merchandiseType),
    packagingType: data.packagingType ? safe(data.packagingType) : data.packagingType,
    quantity: data.quantity ? safe(data.quantity) : data.quantity,
    comments: data.comments ? safe(data.comments) : data.comments,
  };

  const W = 595;
  const margin = 40;

  // Header band.
  page.drawRectangle({ x: 0, y: 842 - 96, width: W, height: 96, color: BLUE });
  page.drawText(t.confirmationTitle, { x: margin, y: 842 - 48, size: 20, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Master Delivery System · COJOJ Dakar 2026", {
    x: margin,
    y: 842 - 68,
    size: 10,
    font,
    color: rgb(1, 1, 1),
  });

  // Logo on a white chip (dark logotype needs a white surface).
  try {
    const bytes = readFileSync(path.join(process.cwd(), "public", "dakar2026-logo.png"));
    const png = await pdf.embedPng(bytes);
    const h = 40;
    const w = (png.width / png.height) * h;
    page.drawRectangle({ x: W - margin - w - 12, y: 842 - 78, width: w + 12, height: 60, color: rgb(1, 1, 1) });
    page.drawImage(png, { x: W - margin - w - 6, y: 842 - 68, width: w, height: h });
  } catch {
    // logo optional
  }

  let y = 842 - 130;

  // Reference + status.
  page.drawText(t.colRef.toUpperCase(), { x: margin, y, size: 8, font: bold, color: GRAY });
  const statusText = t[STATUS_LABEL[data.status]];
  page.drawText(statusText, { x: W - margin - font.widthOfTextAtSize(statusText, 10) - 2, y, size: 8, font: bold, color: GRAY });
  y -= 20;
  page.drawText(data.reference, { x: margin, y, size: 18, font: monoBold, color: BLUE });
  y -= 24;
  page.drawLine({ start: { x: margin, y }, end: { x: W - margin, y }, thickness: 1, color: LINE });
  y -= 22;

  const colX = [margin, 310];
  const drawKV = (col: 0 | 1, label: string, value: string, valueMono = false) => {
    const x = colX[col];
    page.drawText(label.toUpperCase(), { x, y, size: 7.5, font: bold, color: GRAY });
    page.drawText(value || "—", { x, y: y - 13, size: 11, font: valueMono ? mono : font, color: INK });
  };

  const section = (title: string) => {
    page.drawText(title, { x: margin, y, size: 9, font: bold, color: BLUE });
    y -= 18;
  };

  // Booking details.
  section(t.bookingDetails);
  drawKV(0, t.colType, data.type === "delivery" ? t.delivery : t.collection);
  drawKV(1, t.venue, `${data.venueName} (${data.siteCode})`);
  y -= 34;
  drawKV(0, t.compound, data.compoundLabel);
  drawKV(1, t.gate, data.gateLabel);
  y -= 34;
  drawKV(0, t.date, formatLongDate(data.serviceDate, lang));
  drawKV(1, t.window, `${hmOf(data.slotStart)} - ${hmOf(data.slotEnd)}`, true);
  y -= 40;

  // Shipment — quantity / weight / volume shown separately (spec §14).
  section(t.shipment);
  drawKV(0, t.vehicleType, data.vehicleType);
  drawKV(1, t.merchType, data.merchandiseType);
  y -= 34;
  drawKV(0, t.packType, data.packagingType ?? "—");
  y -= 34;
  drawKV(0, t.qty, data.quantity ?? "—", true);
  page.drawText(t.weight.toUpperCase(), { x: 220, y, size: 7.5, font: bold, color: GRAY });
  page.drawText(data.weightKg != null ? String(data.weightKg) : "—", { x: 220, y: y - 13, size: 11, font: mono, color: INK });
  page.drawText(t.volume.toUpperCase(), { x: 400, y, size: 7.5, font: bold, color: GRAY });
  page.drawText(data.volumeM3 != null ? String(data.volumeM3) : "—", { x: 400, y: y - 13, size: 11, font: mono, color: INK });
  y -= 40;

  // Parties.
  section(t.parties);
  drawKV(0, t.supplier, data.supplierName);
  drawKV(1, t.supplierPhone, data.supplierContact ?? "—");
  y -= 34;
  drawKV(0, t.transporter, data.transporterName);
  drawKV(1, t.transporterPhone, data.transporterContact, true);
  y -= 40;

  if (data.comments) {
    section(t.comments);
    page.drawText(data.comments.slice(0, 120), { x: margin, y: y + 2, size: 10, font, color: INK });
    y -= 24;
  }

  // Footer.
  page.drawLine({ start: { x: margin, y: 70 }, end: { x: W - margin, y: 70 }, thickness: 1, color: LINE });
  const issued = `${t.issuedOn} ${formatLongDate(data.createdAt, lang)} ${hmOf(data.createdAt)}`;
  page.drawText(issued, { x: margin, y: 56, size: 8, font, color: GRAY });
  page.drawText(t.loginFooter, { x: margin, y: 44, size: 8, font, color: GRAY });

  return pdf.save();
}

export interface BookingListRow {
  reference: string;
  bookingType: string;
  company: string;
  date: string;
  window: string;
  venue: string;
  transporter: string;
  transporterContact: string;
  compound: string;
  gate: string;
  vehicleType: string;
  merchandiseType: string;
  status: string;
}

export interface BookingListMeta {
  title: string;
  subtitle: string;
  generatedAt: Date;
}

/** Branded, paginated PDF of the filtered booking list (spec §17). Landscape A4;
 *  booking type is a prominent labelled column. */
export async function buildBookingListPdf(
  rows: BookingListRow[],
  meta: BookingListMeta,
  lang: Lang,
): Promise<Uint8Array> {
  const t = getDict(lang);
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.Courier);

  const safe = makePdfSafe(font);
  rows = rows.map((r) => ({
    reference: r.reference,
    bookingType: safe(r.bookingType),
    company: safe(r.company),
    date: r.date,
    window: safe(r.window),
    venue: safe(r.venue),
    transporter: safe(r.transporter),
    transporterContact: safe(r.transporterContact),
    compound: safe(r.compound),
    gate: safe(r.gate),
    vehicleType: safe(r.vehicleType),
    merchandiseType: safe(r.merchandiseType),
    status: r.status,
  }));
  meta = { ...meta, title: safe(meta.title), subtitle: safe(meta.subtitle) };

  const W = 842;
  const H = 595;
  const margin = 28;

  // Column definitions: [key, header, width]. Widths sum to the usable width.
  const cols: [keyof BookingListRow, string, number][] = [
    ["reference", t.colRef, 88],
    ["bookingType", t.colType, 62],
    ["company", t.colSupplier, 92],
    ["date", t.date, 58],
    ["window", t.colWindow, 66],
    ["venue", t.venue, 78],
    ["transporter", t.colTransporter, 82],
    ["transporterContact", t.transporterPhone, 66],
    ["compound", t.compound, 70],
    ["gate", t.gate, 44],
    ["vehicleType", t.vehicleType, 60],
    ["merchandiseType", t.merchType, 62],
    ["status", t.colStatus, 58],
  ];

  const colX: number[] = [];
  let acc = margin;
  for (const [, , w] of cols) {
    colX.push(acc);
    acc += w;
  }

  const clip = (s: string, w: number, size: number, f = font) => {
    let str = s ?? "";
    while (str.length > 1 && f.widthOfTextAtSize(str, size) > w - 4) {
      str = str.slice(0, -1);
    }
    return str;
  };

  let page = pdf.addPage([W, H]);
  let pageNo = 1;

  const drawChrome = () => {
    page.drawRectangle({ x: 0, y: H - 54, width: W, height: 54, color: BLUE });
    page.drawText(meta.title, { x: margin, y: H - 30, size: 14, font: bold, color: rgb(1, 1, 1) });
    page.drawText(meta.subtitle, { x: margin, y: H - 46, size: 9, font, color: rgb(1, 1, 1) });
    const stamp = `${t.issuedOn} ${formatLongDate(meta.generatedAt, lang)} ${hmOf(meta.generatedAt)}`;
    page.drawText(stamp, {
      x: W - margin - font.widthOfTextAtSize(stamp, 8),
      y: H - 44,
      size: 8,
      font,
      color: rgb(1, 1, 1),
    });
  };

  const drawHeaderRow = (y: number) => {
    page.drawRectangle({ x: margin, y: y - 4, width: W - 2 * margin, height: 18, color: rgb(0.96, 0.97, 0.98) });
    cols.forEach(([, header, w], i) => {
      page.drawText(clip(header.toUpperCase(), w, 6.5, bold), { x: colX[i] + 2, y, size: 6.5, font: bold, color: GRAY });
    });
  };

  const top = H - 74;
  const rowH = 15;
  const bottom = 40;

  drawChrome();
  drawHeaderRow(top);
  let y = top - rowH;

  for (const r of rows) {
    if (y < bottom) {
      page.drawText(`${t.loginFooter}`, { x: margin, y: 24, size: 7, font, color: GRAY });
      page.drawText(`${pageNo}`, { x: W - margin - 10, y: 24, size: 7, font, color: GRAY });
      page = pdf.addPage([W, H]);
      pageNo += 1;
      drawChrome();
      drawHeaderRow(top);
      y = top - rowH;
    }
    cols.forEach(([key, , w], i) => {
      const raw = String(r[key] ?? "");
      const isRef = key === "reference" || key === "window" || key === "transporterContact";
      const isType = key === "bookingType";
      const f = isRef ? mono : isType ? bold : font;
      page.drawText(clip(raw, w, 7.5, f), {
        x: colX[i] + 2,
        y,
        size: 7.5,
        font: f,
        color: isType ? BLUE : INK,
      });
    });
    page.drawLine({ start: { x: margin, y: y - 4 }, end: { x: W - margin, y: y - 4 }, thickness: 0.5, color: LINE });
    y -= rowH;
  }

  page.drawText(`${rows.length} · ${t.loginFooter}`, { x: margin, y: 24, size: 7, font, color: GRAY });
  page.drawText(`${pageNo}`, { x: W - margin - 10, y: 24, size: 7, font, color: GRAY });

  return pdf.save();
}
