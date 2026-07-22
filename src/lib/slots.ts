import { prisma } from "./db";
import { ACTIVE_STATUSES } from "./constants";
import { addDays, atMinutes, hmToMinutes } from "./time";

export interface SlotView {
  startMinutes: number;
  endMinutes: number;
  start: Date; // UTC instant (== Dakar wall clock)
  end: Date;
  available: boolean;
}

/** Build the slot grid for a venue on a Dakar day from its OperatingDay record.
 *  Closed days (no active record) yield an empty grid (spec §9, D4). */
export async function getDaySlots(
  venueId: string,
  day: Date,
): Promise<{ open: boolean; openTime?: string; closeTime?: string; slots: SlotView[] }> {
  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    select: { status: true, defaultSlotDurationMinutes: true },
  });
  if (!venue || venue.status !== "active") return { open: false, slots: [] };

  const operatingDay = await prisma.operatingDay.findUnique({
    where: { venueId_date: { venueId, date: day } },
  });
  if (!operatingDay || !operatingDay.active) return { open: false, slots: [] };

  const duration = venue.defaultSlotDurationMinutes;
  const openMin = hmToMinutes(operatingDay.openTime);
  const closeMin = hmToMinutes(operatingDay.closeTime);

  // Active holds for this venue on this day block the matching slot (D8).
  const dayEnd = addDays(day, 1);
  const holds = await prisma.slotHold.findMany({
    where: {
      venueId,
      slotStart: { gte: day, lt: dayEnd },
      booking: { status: { in: ACTIVE_STATUSES } },
    },
    select: { slotStart: true },
  });
  const held = new Set(holds.map((h) => h.slotStart.getTime()));

  // A slot is only bookable if it has not already started in Senegal local time
  // (== UTC, no DST). Past slots on today — and every slot on past days — render
  // as unavailable and are rejected server-side (spec §9, §18).
  const now = Date.now();

  const slots: SlotView[] = [];
  for (let m = openMin; m + duration <= closeMin; m += duration) {
    const start = atMinutes(day, m);
    const end = atMinutes(day, m + duration);
    slots.push({
      startMinutes: m,
      endMinutes: m + duration,
      start,
      end,
      available: !held.has(start.getTime()) && start.getTime() > now,
    });
  }

  return {
    open: true,
    openTime: operatingDay.openTime,
    closeTime: operatingDay.closeTime,
    slots,
  };
}
