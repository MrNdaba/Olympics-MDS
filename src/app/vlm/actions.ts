"use server";

import { revalidatePath } from "next/cache";
import { requireRole, assertVenueAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  validateBooking,
  rejectBooking,
  cancelBooking,
  reinstateBooking,
  BookingError,
} from "@/lib/booking";

type Result = { ok: boolean; error?: string };

async function loadScoped(bookingId: string) {
  const user = await requireRole("vlm", "admin");
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return { user, booking: null };
  assertVenueAccess(user, booking.venueId); // server-side venue scoping (spec §4)
  return { user, booking };
}

export async function validateBookingAction(bookingId: string): Promise<Result> {
  const { user, booking } = await loadScoped(bookingId);
  if (!booking) return { ok: false, error: "Not found." };
  try {
    await validateBooking(bookingId, user);
    revalidatePath("/vlm");
    revalidatePath("/vlm/dashboard");
    return { ok: true };
  } catch (e) {
    if (e instanceof BookingError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function rejectBookingAction(bookingId: string, reason: string): Promise<Result> {
  const { user, booking } = await loadScoped(bookingId);
  if (!booking) return { ok: false, error: "Not found." };
  try {
    await rejectBooking(bookingId, user, reason);
    revalidatePath("/vlm");
    return { ok: true };
  } catch (e) {
    if (e instanceof BookingError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function cancelBookingAction(bookingId: string, reason: string): Promise<Result> {
  const { user, booking } = await loadScoped(bookingId);
  if (!booking) return { ok: false, error: "Not found." };
  try {
    await cancelBooking(bookingId, user, reason);
    revalidatePath("/vlm");
    return { ok: true };
  } catch (e) {
    if (e instanceof BookingError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function reinstateBookingAction(bookingId: string, reason: string): Promise<Result> {
  const { user, booking } = await loadScoped(bookingId);
  if (!booking) return { ok: false, error: "Not found." };
  try {
    await reinstateBooking(bookingId, user, reason);
    revalidatePath("/vlm");
    return { ok: true };
  } catch (e) {
    if (e instanceof BookingError) return { ok: false, error: e.message };
    throw e;
  }
}
