"use server";

import { revalidatePath } from "next/cache";
import { requireRole, assertVenueAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseDakarDay, hmToMinutes, rangesOverlap } from "@/lib/time";
import { DEPARTMENTS, type Department } from "@/lib/constants";
import { log } from "@/lib/logger";

type Result = { ok: boolean; error?: string };

const HM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Resolve the venue and enforce server-side venue scoping (spec §4, §15.5). */
async function scopeVenue(venueId: string) {
  const user = await requireRole("vlm", "admin");
  assertVenueAccess(user, venueId);
  return user;
}

/** Add or update an operating period for one day (§10, §15.5). */
export async function setOperatingDayAction(
  venueId: string,
  dateIso: string,
  openTime: string,
  closeTime: string,
): Promise<Result> {
  const user = await scopeVenue(venueId);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return { ok: false, error: "Invalid date." };
  if (!HM.test(openTime) || !HM.test(closeTime)) {
    return { ok: false, error: "Times must be HH:mm." };
  }
  if (hmToMinutes(openTime) >= hmToMinutes(closeTime)) {
    return { ok: false, error: "Opening time must be before closing time." };
  }

  const date = parseDakarDay(dateIso);
  await prisma.operatingDay.upsert({
    where: { venueId_date: { venueId, date } },
    create: { venueId, date, openTime, closeTime, active: true },
    update: { openTime, closeTime, active: true },
  });
  log.info("vlm.operating_day_set", { by: user.id, venueId, date: dateIso, openTime, closeTime });
  revalidatePath("/vlm/venue");
  return { ok: true };
}

/** Mark a day closed to deliveries/collections (active=false → no slots, D4). */
export async function closeOperatingDayAction(venueId: string, dateIso: string): Promise<Result> {
  const user = await scopeVenue(venueId);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return { ok: false, error: "Invalid date." };

  const date = parseDakarDay(dateIso);
  const existing = await prisma.operatingDay.findUnique({
    where: { venueId_date: { venueId, date } },
  });
  if (!existing) return { ok: false, error: "Not found." };

  await prisma.operatingDay.update({
    where: { venueId_date: { venueId, date } },
    data: { active: false },
  });
  log.info("vlm.operating_day_closed", { by: user.id, venueId, date: dateIso });
  revalidatePath("/vlm/venue");
  return { ok: true };
}

/** Adjust the per-venue slot duration (§9, §15.5) — VLM/Admin, scoped. */
export async function setVenueSlotDurationAction(venueId: string, minutes: number): Promise<Result> {
  const user = await scopeVenue(venueId);
  const duration = Number(minutes);
  if (!Number.isInteger(duration) || duration < 5 || duration > 240) {
    return { ok: false, error: "Slot duration must be 5–240 min." };
  }
  await prisma.venue.update({
    where: { id: venueId },
    data: { defaultSlotDurationMinutes: duration },
  });
  log.info("vlm.venue_slot_duration", { by: user.id, venueId, duration });
  revalidatePath("/vlm/venue");
  return { ok: true };
}

/** Activate / deactivate the booking window for a venue (§15.5). */
export async function setBookingWindowAction(venueId: string, open: boolean): Promise<Result> {
  const user = await scopeVenue(venueId);
  await prisma.venue.update({
    where: { id: venueId },
    data: { bookingWindowOpen: Boolean(open) },
  });
  log.info("vlm.booking_window", { by: user.id, venueId, open: Boolean(open) });
  revalidatePath("/vlm/venue");
  return { ok: true };
}

// ── Break periods (non-bookable windows within an open day) ───────────────────

/** Add a break period to one operating day. The day must already be open;
 *  the break must sit within its hours and not overlap an existing break. */
export async function addBreakAction(
  venueId: string,
  dateIso: string,
  startTime: string,
  endTime: string,
  label?: string,
): Promise<Result> {
  const user = await scopeVenue(venueId);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return { ok: false, error: "Invalid date." };
  if (!HM.test(startTime) || !HM.test(endTime)) return { ok: false, error: "Times must be HH:mm." };
  const startMin = hmToMinutes(startTime);
  const endMin = hmToMinutes(endTime);
  if (startMin >= endMin) return { ok: false, error: "Break start must be before its end." };

  const date = parseDakarDay(dateIso);
  const operatingDay = await prisma.operatingDay.findUnique({
    where: { venueId_date: { venueId, date } },
    include: { breaks: true },
  });
  if (!operatingDay || !operatingDay.active) {
    return { ok: false, error: "Set operating hours for this day before adding a break." };
  }
  if (startMin < hmToMinutes(operatingDay.openTime) || endMin > hmToMinutes(operatingDay.closeTime)) {
    return { ok: false, error: "Break must fall within the day's operating hours." };
  }
  const overlapsExisting = operatingDay.breaks.some((b) =>
    rangesOverlap(startMin, endMin, hmToMinutes(b.startTime), hmToMinutes(b.endTime)),
  );
  if (overlapsExisting) return { ok: false, error: "This break overlaps an existing one." };

  await prisma.operatingDayBreak.create({
    data: { operatingDayId: operatingDay.id, startTime, endTime, label: label?.trim() || null },
  });
  log.info("vlm.break_added", { by: user.id, venueId, date: dateIso, startTime, endTime });
  revalidatePath("/vlm/venue");
  return { ok: true };
}

/** Remove a break period. Scoped through its operating day's venue so a break
 *  id can't be used to reach into another venue's schedule. */
export async function removeBreakAction(venueId: string, breakId: string): Promise<Result> {
  const user = await scopeVenue(venueId);
  const brk = await prisma.operatingDayBreak.findFirst({
    where: { id: breakId, operatingDay: { venueId } },
  });
  if (!brk) return { ok: false, error: "Not found." };

  await prisma.operatingDayBreak.delete({ where: { id: breakId } });
  log.info("vlm.break_removed", { by: user.id, venueId, breakId });
  revalidatePath("/vlm/venue");
  return { ok: true };
}

// ── Compound & gate maintenance (spec §8, §15.5) ──────────────────────────────

/** Add a drop-off/collection compound to a venue. Department is derived from the
 *  compound (Register #9); uniqueness is (venue, department, label). */
export async function addCompoundAction(
  venueId: string,
  department: string,
  label: string,
): Promise<Result> {
  const user = await scopeVenue(venueId);
  const dept = String(department) as Department;
  if (!DEPARTMENTS.includes(dept)) return { ok: false, error: "Invalid department." };
  const trimmed = label.trim();
  if (!trimmed) return { ok: false, error: "Label is required." };

  const existing = await prisma.compound.findUnique({
    where: { venueId_department_label: { venueId, department: dept, label: trimmed } },
  });
  if (existing) return { ok: false, error: "That compound already exists." };

  await prisma.compound.create({ data: { venueId, department: dept, label: trimmed } });
  log.info("vlm.compound_added", { by: user.id, venueId, department: dept, label: trimmed });
  revalidatePath("/vlm/venue");
  return { ok: true };
}

/** Remove a compound. Blocked if any booking references it (audit trail, §12/§19). */
export async function removeCompoundAction(venueId: string, compoundId: string): Promise<Result> {
  const user = await scopeVenue(venueId);
  const compound = await prisma.compound.findFirst({ where: { id: compoundId, venueId } });
  if (!compound) return { ok: false, error: "Not found." };

  const used = await prisma.booking.count({ where: { compoundId } });
  if (used > 0) return { ok: false, error: "Cannot remove — bookings reference this compound." };

  await prisma.compound.delete({ where: { id: compoundId } });
  log.info("vlm.compound_removed", { by: user.id, venueId, compoundId });
  revalidatePath("/vlm/venue");
  return { ok: true };
}

/** Add an access gate to a venue. Uniqueness is (venue, label). */
export async function addGateAction(venueId: string, label: string): Promise<Result> {
  const user = await scopeVenue(venueId);
  const trimmed = label.trim();
  if (!trimmed) return { ok: false, error: "Label is required." };

  const existing = await prisma.gate.findUnique({
    where: { venueId_label: { venueId, label: trimmed } },
  });
  if (existing) return { ok: false, error: "That gate already exists." };

  await prisma.gate.create({ data: { venueId, label: trimmed } });
  log.info("vlm.gate_added", { by: user.id, venueId, label: trimmed });
  revalidatePath("/vlm/venue");
  return { ok: true };
}

/** Remove a gate. Blocked if any booking references it (audit trail, §12/§19). */
export async function removeGateAction(venueId: string, gateId: string): Promise<Result> {
  const user = await scopeVenue(venueId);
  const gate = await prisma.gate.findFirst({ where: { id: gateId, venueId } });
  if (!gate) return { ok: false, error: "Not found." };

  const used = await prisma.booking.count({ where: { gateId } });
  if (used > 0) return { ok: false, error: "Cannot remove — bookings reference this gate." };

  await prisma.gate.delete({ where: { id: gateId } });
  log.info("vlm.gate_removed", { by: user.id, venueId, gateId });
  revalidatePath("/vlm/venue");
  return { ok: true };
}

/** Enable or disable a compound→gate routing combination (spec §8). */
export async function setRouteAction(
  venueId: string,
  compoundId: string,
  gateId: string,
  allowed: boolean,
): Promise<Result> {
  const user = await scopeVenue(venueId);
  // Both endpoints must belong to the scoped venue.
  const [compound, gate] = await Promise.all([
    prisma.compound.findFirst({ where: { id: compoundId, venueId } }),
    prisma.gate.findFirst({ where: { id: gateId, venueId } }),
  ]);
  if (!compound || !gate) return { ok: false, error: "Not found." };

  if (allowed) {
    await prisma.compoundGate.upsert({
      where: { compoundId_gateId: { compoundId, gateId } },
      create: { compoundId, gateId },
      update: {},
    });
  } else {
    // Cannot remove a routing that active bookings still depend on.
    const used = await prisma.booking.count({
      where: { compoundId, gateId, status: { in: ["PendingValidation", "Confirmed"] } },
    });
    if (used > 0) return { ok: false, error: "Cannot remove — active bookings use this route." };
    await prisma.compoundGate.deleteMany({ where: { compoundId, gateId } });
  }
  log.info("vlm.route_set", { by: user.id, venueId, compoundId, gateId, allowed: Boolean(allowed) });
  revalidatePath("/vlm/venue");
  return { ok: true };
}
