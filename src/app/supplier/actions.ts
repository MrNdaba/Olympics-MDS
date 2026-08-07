"use server";

import { revalidatePath } from "next/cache";
import { requireRole, requireUser } from "@/lib/auth";
import { getVenueRouting } from "@/lib/venues";
import { getDaySlots } from "@/lib/slots";
import { createBooking, cancelBooking, BookingError } from "@/lib/booking";
import { parseDakarDay } from "@/lib/time";
import type { BookingType } from "@/lib/constants";

export async function getRouting(venueId: string) {
  await requireUser();
  return getVenueRouting(venueId);
}

export interface SlotDto {
  startMinutes: number;
  endMinutes: number;
  available: boolean;
}

export async function getSlots(
  venueId: string,
  dateIso: string,
): Promise<{ open: boolean; openTime?: string; closeTime?: string; slots: SlotDto[] }> {
  await requireUser();
  const day = parseDakarDay(dateIso);
  const result = await getDaySlots(venueId, day);
  return {
    open: result.open,
    openTime: result.openTime,
    closeTime: result.closeTime,
    slots: result.slots.map((s) => ({
      startMinutes: s.startMinutes,
      endMinutes: s.endMinutes,
      available: s.available,
    })),
  };
}

export interface CreateBookingActionInput {
  type: BookingType;
  supplierContact: string;
  transporterName: string;
  transporterContact: string;
  vehicleType: string;
  merchandiseType: string;
  packagingType?: string;
  quantity?: string;
  weightKg?: string;
  volumeM3?: string;
  venueId: string;
  compoundId: string;
  gateId: string;
  dateIso: string;
  slotStartMinutes: number;
  slotEndMinutes: number;
  comments?: string;
}

export async function createBookingAction(
  input: CreateBookingActionInput,
): Promise<{ ok: true; reference: string; id: string } | { ok: false; error: string }> {
  const user = await requireRole("supplier");

  // Rate limit booking submissions per user (spec §19).
  const { RATE_LIMITS } = await import("@/lib/constants");
  const { consumeRateLimit } = await import("@/lib/rate-limit");
  const limit = consumeRateLimit(`booking:${user.id}`, RATE_LIMITS.booking.max, RATE_LIMITS.booking.windowMs);
  if (!limit.ok) {
    return { ok: false, error: "Too many booking attempts. Please wait a moment and try again." };
  }

  try {
    const booking = await createBooking(
      {
        type: input.type,
        supplierName: user.name,
        supplierContact: input.supplierContact,
        transporterName: input.transporterName,
        transporterContact: input.transporterContact,
        vehicleType: input.vehicleType,
        merchandiseType: input.merchandiseType,
        packagingType: input.packagingType || undefined,
        quantity: input.quantity || undefined,
        weightKg: input.weightKg ? Number(input.weightKg) : undefined,
        volumeM3: input.volumeM3 ? Number(input.volumeM3) : undefined,
        venueId: input.venueId,
        compoundId: input.compoundId,
        gateId: input.gateId,
        serviceDate: parseDakarDay(input.dateIso),
        slotStartMinutes: input.slotStartMinutes,
        slotEndMinutes: input.slotEndMinutes,
        comments: input.comments || undefined,
      },
      user,
    );
    revalidatePath("/supplier");
    return { ok: true, reference: booking.reference, id: booking.id };
  } catch (e) {
    if (e instanceof BookingError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function cancelMyBooking(
  bookingId: string,
  reason?: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireRole("supplier");
  const { prisma } = await import("@/lib/db");
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  // Ownership check — a supplier may only cancel their own bookings (spec §4).
  if (!booking || booking.createdById !== user.id) {
    return { ok: false, error: "Not found." };
  }
  try {
    await cancelBooking(bookingId, user, reason);
    revalidatePath("/supplier");
    revalidatePath("/supplier/bookings");
    return { ok: true };
  } catch (e) {
    if (e instanceof BookingError) return { ok: false, error: e.message };
    throw e;
  }
}
