import { prisma } from "./db";
import { getDaySlots } from "./slots";
import { addDays, dayIso, formatShortDate, hmOf, parseDakarDay } from "./time";

// Dashboard date-range report (items #7/#8): historical days show booking
// totals by day; current/future days show slot-level booking detail. Capped
// so a mistakenly huge range can't trigger an unbounded query fan-out.
const MAX_RANGE_DAYS = 31;

export interface RangeReportDaySlot {
  time: string;
  booked: boolean;
}

export interface RangeReportDay {
  dateIso: string;
  dateDisplay: string;
  historical: boolean;
  // Historical days (§ totals by day).
  totalBookings?: number;
  byStatus?: { Confirmed: number; PendingValidation: number; Cancelled: number; Expired: number };
  // Current/future days (§ slot-level detail). `open` false = venue closed
  // that day (no slots generated).
  open?: boolean;
  slots?: RangeReportDaySlot[];
  bookedCount?: number;
}

export interface RangeReport {
  days: RangeReportDay[];
  truncated: boolean;
}

/** Builds the per-day dashboard report for [fromIso, toIso]. Slot-level detail
 *  (current/future days) is scoped to `primaryVenueId`, mirroring the
 *  single-day "venue load" grid elsewhere on the dashboard. Historical totals
 *  aggregate across every venue in `venueIds`. */
export async function getVenueLoadRangeReport(opts: {
  venueIds: string[];
  primaryVenueId?: string;
  fromIso: string;
  toIso: string;
}): Promise<RangeReport> {
  const { venueIds, primaryVenueId } = opts;
  const fromDay = parseDakarDay(opts.fromIso);
  const toDayRaw = parseDakarDay(opts.toIso);
  const toDay = toDayRaw.getTime() < fromDay.getTime() ? fromDay : toDayRaw;
  const today = parseDakarDay(dayIso(new Date()));

  const allDays: Date[] = [];
  for (let d = fromDay; d.getTime() <= toDay.getTime() && allDays.length < MAX_RANGE_DAYS; d = addDays(d, 1)) {
    allDays.push(d);
  }
  const truncated = allDays.length >= MAX_RANGE_DAYS && addDays(fromDay, MAX_RANGE_DAYS - 1).getTime() < toDay.getTime();

  const days: RangeReportDay[] = [];
  for (const day of allDays) {
    const iso = dayIso(day);
    const dateDisplay = formatShortDate(day);
    const historical = day.getTime() < today.getTime();

    if (historical) {
      const bookings = await prisma.booking.findMany({
        where: { venueId: { in: venueIds }, serviceDate: day },
        select: { status: true },
      });
      days.push({
        dateIso: iso,
        dateDisplay,
        historical: true,
        totalBookings: bookings.length,
        byStatus: {
          Confirmed: bookings.filter((b) => b.status === "Confirmed").length,
          PendingValidation: bookings.filter((b) => b.status === "PendingValidation").length,
          Cancelled: bookings.filter((b) => b.status === "Cancelled").length,
          Expired: bookings.filter((b) => b.status === "Expired").length,
        },
      });
      continue;
    }

    if (!primaryVenueId) {
      days.push({ dateIso: iso, dateDisplay, historical: false, open: false, slots: [] });
      continue;
    }
    const grid = await getDaySlots(primaryVenueId, day);
    if (!grid.open) {
      days.push({ dateIso: iso, dateDisplay, historical: false, open: false, slots: [] });
      continue;
    }
    const dayEnd = addDays(day, 1);
    const holds = await prisma.slotHold.findMany({
      where: { venueId: primaryVenueId, slotStart: { gte: day, lt: dayEnd } },
      include: { booking: { select: { status: true } } },
    });
    const holdByStart = new Map(holds.map((h) => [h.slotStart.getTime(), h.booking.status]));
    const slots: RangeReportDaySlot[] = grid.slots.map((s) => {
      const status = holdByStart.get(s.start.getTime());
      return { time: hmOf(s.start), booked: status === "Confirmed" || status === "PendingValidation" };
    });
    days.push({
      dateIso: iso,
      dateDisplay,
      historical: false,
      open: true,
      slots,
      bookedCount: slots.filter((s) => s.booked).length,
    });
  }

  return { days, truncated };
}
