// Time helpers. Senegal is GMT/UTC+00:00 with NO DST, so Africa/Dakar local time
// is identical to UTC. We therefore store instants in UTC and read/write the
// wall-clock using the UTC accessors — never the host locale (spec §18).

const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight (00:00 Dakar == 00:00 UTC) of the calendar day containing `d`. */
export function dakarDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Parse an ISO date string (YYYY-MM-DD) as a Dakar day at 00:00. */
export function parseDakarDay(iso: string): Date {
  const [y, m, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

/** "YYYY-MM-DD" for a Dakar day. */
export function dayIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** "HH:mm" → minutes since midnight. */
export function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

/** minutes since midnight → "HH:mm". */
export function minutesToHm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Wall-clock "HH:mm" of an instant, in Dakar time. */
export function hmOf(d: Date): string {
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(
    d.getUTCMinutes(),
  ).padStart(2, "0")}`;
}

/** Combine a Dakar day (00:00) with "HH:mm" into a UTC instant. */
export function atMinutes(dayStart: Date, minutes: number): Date {
  return new Date(dayStart.getTime() + minutes * 60_000);
}

export function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60_000);
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

/** Whether two [start, end) minute ranges overlap (half-open, so touching
 *  edges — e.g. one ending at 12:00 and the other starting at 12:00 — do not
 *  count as an overlap). Shared by slot generation and booking validation
 *  when checking a window against a venue's break periods. */
export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/** Merged-window display, e.g. "10:00 → 11:30" (spec §9). */
export function formatWindow(start: Date, end: Date): string {
  return `${hmOf(start)} → ${hmOf(end)}`;
}

/** Localised long date, e.g. "Lundi 02 novembre 2026" / "Monday 02 November 2026". */
export function formatLongDate(d: Date, lang: "fr" | "en"): string {
  return new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC", // UTC == Africa/Dakar
  }).format(d);
}

/** Short numeric date, e.g. "02/11/2026". */
export function formatShortDate(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}
