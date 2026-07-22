"use server";

import { revalidatePath } from "next/cache";
import { requireUser, assertVenueAccess, type SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { amendBooking, BookingError } from "@/lib/booking";
import { parseDakarDay } from "@/lib/time";
import type { BookingType } from "@/lib/constants";

async function authorize(bookingId: string, user: SessionUser) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return null;
  if (user.role === "supplier") {
    if (booking.createdById !== user.id) return null; // own bookings only
  } else {
    assertVenueAccess(user, booking.venueId); // VLM/Admin venue scope
  }
  return booking;
}

export interface AmendActionInput {
  type: BookingType;
  supplierContact?: string;
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

export async function amendBookingAction(
  bookingId: string,
  input: AmendActionInput,
): Promise<{ ok: true; reference: string } | { ok: false; error: string }> {
  const user = await requireUser();
  const existing = await authorize(bookingId, user);
  if (!existing) return { ok: false, error: "Not found." };

  try {
    const updated = await amendBooking(bookingId, user, {
      type: input.type,
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
    });
    revalidatePath("/supplier");
    revalidatePath("/vlm");
    revalidatePath("/vlm/dashboard");
    return { ok: true, reference: updated.reference };
  } catch (e) {
    if (e instanceof BookingError) return { ok: false, error: e.message };
    throw e;
  }
}
