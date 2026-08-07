import { prisma } from "./db";
import { log } from "./logger";
import { notifications } from "./notifications";
import { sendEmail } from "./email";
import { buildConfirmationPdf } from "./pdf";
import { DEFAULT_LANG, getDict } from "./i18n";
import {
  ACTIVE_STATUSES,
  AUTO_CONFIRM_THRESHOLD_HOURS,
  MAX_BOOKING_MINUTES,
  type BookingStatus,
  type BookingType,
} from "./constants";
import { atMinutes, formatLongDate, hmOf, hmToMinutes } from "./time";
import type { SessionUser } from "./auth";

export function formatReference(siteCode: string, refNumber: number): string {
  return `OLY-${siteCode}-${String(refNumber).padStart(6, "0")}`;
}

export interface CreateBookingInput {
  type: BookingType;
  supplierName: string;
  supplierContact: string;
  transporterName: string;
  transporterContact: string;
  vehicleType: string;
  merchandiseType: string;
  packagingType?: string;
  quantity?: string;
  weightKg?: number;
  volumeM3?: number;
  venueId: string;
  compoundId: string;
  gateId: string;
  serviceDate: Date; // Dakar day at 00:00
  slotStartMinutes: number; // minutes since midnight
  slotEndMinutes: number; // merged window end
  comments?: string;
}

export class BookingError extends Error {}

/** Create a booking with atomic, race-safe slot reservation (spec §9, §11, D8). */
export async function createBooking(input: CreateBookingInput, user: SessionUser) {
  if (!input.supplierContact || !input.supplierContact.trim()) {
    throw new BookingError("Supplier phone number is required.");
  }

  const venue = await prisma.venue.findUnique({ where: { id: input.venueId } });
  if (!venue || venue.status !== "active") {
    throw new BookingError("Venue is not active.");
  }
  if (!venue.bookingWindowOpen) {
    throw new BookingError("Bookings are closed for this venue.");
  }

  // Routing must be a permitted compound→gate pair for this venue (spec §8).
  const compound = await prisma.compound.findFirst({
    where: { id: input.compoundId, venueId: input.venueId },
  });
  const route = await prisma.compoundGate.findFirst({
    where: { compoundId: input.compoundId, gateId: input.gateId },
    include: { gate: true },
  });
  if (!compound || !route || route.gate.venueId !== input.venueId) {
    throw new BookingError("Invalid compound/gate combination.");
  }

  const operatingDay = await prisma.operatingDay.findUnique({
    where: { venueId_date: { venueId: input.venueId, date: input.serviceDate } },
  });
  if (!operatingDay || !operatingDay.active) {
    throw new BookingError("Venue is closed on the selected date.");
  }

  const duration = venue.defaultSlotDurationMinutes;
  const { slotStartMinutes: startMin, slotEndMinutes: endMin } = input;
  const total = endMin - startMin;

  if (total <= 0) throw new BookingError("Select at least one slot.");
  if (total > MAX_BOOKING_MINUTES) {
    throw new BookingError("Cumulative duration exceeds the 2-hour limit.");
  }
  if (total % duration !== 0 || startMin % duration !== 0) {
    throw new BookingError("Slot selection is misaligned.");
  }
  if (
    startMin < hmToMinutes(operatingDay.openTime) ||
    endMin > hmToMinutes(operatingDay.closeTime)
  ) {
    throw new BookingError("Selected window is outside operating hours.");
  }

  const slotStart = atMinutes(input.serviceDate, startMin);
  const slotEnd = atMinutes(input.serviceDate, endMin);
  if (slotStart.getTime() <= Date.now()) {
    throw new BookingError("Selected slot has already started. Please pick a later slot.");
  }
  const slotStarts: Date[] = [];
  for (let m = startMin; m < endMin; m += duration) {
    slotStarts.push(atMinutes(input.serviceDate, m));
  }

  // 48-hour rule (spec §12): >48h before slot → auto-confirm, else pending.
  const hoursUntil = (slotStart.getTime() - Date.now()) / 3_600_000;
  const status: BookingStatus =
    hoursUntil > AUTO_CONFIRM_THRESHOLD_HOURS ? "Confirmed" : "PendingValidation";

  const booking = await prisma.$transaction(async (tx) => {
    const seq = await tx.referenceSequence.upsert({
      where: { id: 1 },
      create: { id: 1, value: 1 },
      update: { value: { increment: 1 } },
    });
    const refNumber = seq.value;

    const created = await tx.booking.create({
      data: {
        reference: formatReference(venue.siteCode, refNumber),
        refNumber,
        siteCode: venue.siteCode,
        type: input.type,
        status,
        supplierName: input.supplierName,
        supplierContact: input.supplierContact,
        transporterName: input.transporterName,
        transporterContact: input.transporterContact,
        vehicleType: input.vehicleType,
        merchandiseType: input.merchandiseType,
        packagingType: input.packagingType,
        quantity: input.quantity,
        weightKg: input.weightKg,
        volumeM3: input.volumeM3,
        venueId: input.venueId,
        compoundId: input.compoundId,
        gateId: input.gateId,
        serviceDate: input.serviceDate,
        slotStart,
        slotEnd,
        comments: input.comments,
        createdById: user.id,
      },
    });

    // One hold per slot. Unique (venueId, slotStart) makes concurrent winners
    // impossible — a clash throws and rolls back the whole transaction (§9/§23).
    for (const s of slotStarts) {
      await tx.slotHold.create({
        data: { venueId: input.venueId, slotStart: s, bookingId: created.id },
      });
    }

    await tx.bookingAuditEntry.create({
      data: {
        bookingId: created.id,
        userId: user.id,
        action: "created",
        newStatus: status,
        detail: JSON.stringify({
          venue: venue.siteCode,
          date: input.serviceDate.toISOString().slice(0, 10),
          window: `${startMin}-${endMin}`,
        }),
      },
    });

    return created;
  }).catch((e: unknown) => {
    // Prisma unique-constraint violation on SlotHold → slot already taken.
    if (typeof e === "object" && e && "code" in e && (e as { code: string }).code === "P2002") {
      throw new BookingError("One of the selected slots was just taken. Please pick another.");
    }
    throw e;
  });

  await afterCreateNotifications(booking.id, status);
  log.info("booking.created", {
    bookingId: booking.id,
    reference: booking.reference,
    status,
    userId: user.id,
  });
  return booking;
}

/** Email every active VLM assigned to a venue (spec §14). */
async function notifyVenueVlms(
  venueId: string,
  template: string,
  payload: Record<string, unknown>,
) {
  const vlms = await prisma.user.findMany({
    where: {
      role: "vlm",
      status: "active",
      venueAssignments: { some: { venueId } },
    },
    select: { email: true },
  });
  for (const vlm of vlms) {
    await notifications.send({ channel: "email", recipient: vlm.email, template, payload });
  }
}

async function afterCreateNotifications(bookingId: string, status: BookingStatus) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { createdBy: true },
  });
  if (!booking) return;

  // Confirmed → supplier gets in-app + email (with PDF); pending → email only (spec §14).
  const template = status === "Confirmed" ? "booking_confirmed" : "booking_pending";
  await notifications.send({
    channel: "email",
    recipient: booking.createdBy.email,
    template,
    payload: { reference: booking.reference, withPdf: status === "Confirmed" },
  });
  if (status === "Confirmed") {
    await notifications.send({
      channel: "inApp",
      recipient: booking.createdBy.email,
      template,
      payload: { reference: booking.reference },
    });
  }

  // Real confirmation email to the supplier with the branded PDF attached — sent
  // for every booking the supplier makes (spec §14).
  await sendBookingConfirmationEmail(bookingId);

  // Notify the venue's VLM(s) of the new booking (spec §14).
  await notifyVenueVlms(booking.venueId, "vlm_new_booking", { reference: booking.reference });
}

/** Email the supplier a booking confirmation/receipt with the branded PDF (spec §14). */
export async function sendBookingConfirmationEmail(bookingId: string): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { venue: true, compound: true, gate: true, createdBy: true },
  });
  if (!booking) return;

  const lang = DEFAULT_LANG;
  const t = getDict(lang);
  const status = booking.status as BookingStatus;
  const statusLabel =
    status === "Confirmed" ? t.stConfirmed : status === "PendingValidation" ? t.stPending : status;

  let pdf: Uint8Array | undefined;
  try {
    pdf = await buildConfirmationPdf(
      {
        reference: booking.reference,
        type: booking.type as BookingType,
        status,
        siteCode: booking.siteCode,
        venueName: booking.venue.name,
        compoundLabel: booking.compound.label,
        gateLabel: booking.gate.label,
        serviceDate: booking.serviceDate,
        slotStart: booking.slotStart,
        slotEnd: booking.slotEnd,
        supplierName: booking.supplierName,
        supplierContact: booking.supplierContact,
        transporterName: booking.transporterName,
        transporterContact: booking.transporterContact,
        vehicleType: booking.vehicleType,
        merchandiseType: booking.merchandiseType,
        packagingType: booking.packagingType,
        quantity: booking.quantity,
        weightKg: booking.weightKg,
        volumeM3: booking.volumeM3,
        comments: booking.comments,
        createdAt: booking.createdAt,
      },
      lang,
    );
  } catch (e) {
    log.error("booking.confirmation_pdf_failed", { bookingId, error: (e as Error).message });
  }

  const windowStr = `${hmOf(booking.slotStart)} → ${hmOf(booking.slotEnd)}`;
  const dateStr = formatLongDate(booking.serviceDate, lang);
  const subject = `${t.confirmationTitle} · ${booking.reference}`;
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#12202E;max-width:560px">
      <h2 style="color:#0078D0;margin:0 0 4px">${t.confirmationTitle}</h2>
      <p style="margin:0 0 16px;color:#5A6B7C;font-size:13px">Master Delivery System · COJOJ Dakar 2026</p>
      <p style="font-size:14px;margin:0 0 12px">
        <strong>${t.colRef}:</strong>
        <span style="font-family:monospace;color:#0078D0">${booking.reference}</span>
        &nbsp;·&nbsp; <strong>${t.colStatus}:</strong> ${statusLabel}
      </p>
      <table style="font-size:13px;border-collapse:collapse">
        <tr><td style="padding:2px 12px 2px 0;color:#5A6B7C">${t.venue}</td><td>${booking.venue.name} (${booking.siteCode})</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#5A6B7C">${t.date}</td><td>${dateStr}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#5A6B7C">${t.window}</td><td style="font-family:monospace">${windowStr}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#5A6B7C">${t.compound} / ${t.gate}</td><td>${booking.compound.label} · ${booking.gate.label}</td></tr>
      </table>
      <p style="font-size:12px;color:#9AA7B2;margin-top:18px">${t.loginFooter}</p>
    </div>`;
  const text = `${t.confirmationTitle}\n${t.colRef}: ${booking.reference} (${statusLabel})\n${t.venue}: ${booking.venue.name} (${booking.siteCode})\n${t.date}: ${dateStr}\n${t.window}: ${windowStr}\n${booking.compound.label} · ${booking.gate.label}`;

  await sendEmail({
    to: booking.createdBy.email,
    subject,
    html,
    text,
    attachments: pdf
      ? [{ filename: `${booking.reference}.pdf`, content: Buffer.from(pdf), contentType: "application/pdf" }]
      : undefined,
  });
}

async function writeAudit(
  bookingId: string,
  userId: string | null,
  action: string,
  previousStatus: string,
  newStatus: string,
  reason?: string,
) {
  await prisma.bookingAuditEntry.create({
    data: { bookingId, userId, action, previousStatus, newStatus, reason },
  });
}

export async function validateBooking(bookingId: string, user: SessionUser) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new BookingError("Booking not found.");
  if (booking.status !== "PendingValidation") {
    throw new BookingError("Only pending bookings can be validated.");
  }
  await prisma.booking.update({
    where: { id: bookingId },
    data: { status: "Confirmed" },
  });
  await writeAudit(bookingId, user.id, "statusChanged", booking.status, "Confirmed");
  // Booking Confirmed → supplier gets in-app + email (with PDF) (spec §14).
  const supplierEmail = (await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { createdBy: true },
  }))!.createdBy.email;
  await notifications.send({
    channel: "email",
    recipient: supplierEmail,
    template: "booking_confirmed",
    payload: { reference: booking.reference, withPdf: true },
  });
  await notifications.send({
    channel: "inApp",
    recipient: supplierEmail,
    template: "booking_confirmed",
    payload: { reference: booking.reference },
  });
  await sendBookingConfirmationEmail(bookingId);
  log.info("booking.validated", { bookingId, userId: user.id });
}

/** VLM rejection — reason is mandatory (spec §12). Moves to Cancelled, frees slots. */
export async function rejectBooking(bookingId: string, user: SessionUser, reason: string) {
  if (!reason?.trim()) throw new BookingError("A reason is required to reject.");
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new BookingError("Booking not found.");
  if (booking.status !== "PendingValidation") {
    throw new BookingError("Only pending bookings can be rejected.");
  }
  await prisma.$transaction(async (tx) => {
    await tx.booking.update({ where: { id: bookingId }, data: { status: "Cancelled" } });
    await tx.slotHold.deleteMany({ where: { bookingId } });
  });
  await writeAudit(bookingId, user.id, "cancelled", booking.status, "Cancelled", reason);
  await notifyCancellation(bookingId, reason);
  log.info("booking.rejected", { bookingId, userId: user.id });
}

/** Cancellation before slot start. Supplier reason optional, VLM/Admin any time. */
export async function cancelBooking(bookingId: string, user: SessionUser, reason?: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new BookingError("Booking not found.");
  if (!ACTIVE_STATUSES.includes(booking.status as BookingStatus)) {
    throw new BookingError("Only active bookings can be cancelled.");
  }
  if (booking.slotStart.getTime() <= Date.now()) {
    throw new BookingError("Cannot cancel at or after the slot start.");
  }
  await prisma.$transaction(async (tx) => {
    await tx.booking.update({ where: { id: bookingId }, data: { status: "Cancelled" } });
    await tx.slotHold.deleteMany({ where: { bookingId } });
  });
  await writeAudit(bookingId, user.id, "cancelled", booking.status, "Cancelled", reason);
  await notifyCancellation(bookingId, reason, user.role);
  log.info("booking.cancelled", { bookingId, userId: user.id });
}

/** Reinstate a wrongly-cancelled booking (D3): VLM/Admin only, reason required,
 *  slot re-checked and re-held atomically. */
export async function reinstateBooking(bookingId: string, user: SessionUser, reason: string) {
  if (!reason?.trim()) throw new BookingError("A reason is required to reinstate.");
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new BookingError("Booking not found.");
  if (booking.status !== "Cancelled") {
    throw new BookingError("Only cancelled bookings can be reinstated.");
  }
  if (booking.slotStart.getTime() <= Date.now()) {
    throw new BookingError("The slot has already passed.");
  }

  const venue = await prisma.venue.findUnique({ where: { id: booking.venueId } });
  if (!venue || venue.status !== "active") throw new BookingError("Venue is not active.");
  const duration = venue.defaultSlotDurationMinutes;
  const starts: Date[] = [];
  for (let t = booking.slotStart.getTime(); t < booking.slotEnd.getTime(); t += duration * 60_000) {
    starts.push(new Date(t));
  }

  await prisma
    .$transaction(async (tx) => {
      for (const s of starts) {
        await tx.slotHold.create({
          data: { venueId: booking.venueId, slotStart: s, bookingId: booking.id },
        });
      }
      await tx.booking.update({ where: { id: bookingId }, data: { status: "Confirmed" } });
    })
    .catch((e: unknown) => {
      if (typeof e === "object" && e && "code" in e && (e as { code: string }).code === "P2002") {
        throw new BookingError("The slot has since been taken and cannot be reinstated.");
      }
      throw e;
    });

  await writeAudit(bookingId, user.id, "reinstated", "Cancelled", "Confirmed", reason);
  log.info("booking.reinstated", { bookingId, userId: user.id });
}

export interface AmendBookingInput {
  type: BookingType;
  supplierContact: string;
  transporterName: string;
  transporterContact: string;
  vehicleType: string;
  merchandiseType: string;
  packagingType?: string;
  quantity?: string;
  weightKg?: number;
  volumeM3?: number;
  venueId: string;
  compoundId: string;
  gateId: string;
  serviceDate: Date;
  slotStartMinutes: number;
  slotEndMinutes: number;
  comments?: string;
}

/** Amend a Pending/Confirmed booking before slot start (spec §13). The slot swap
 *  is atomic — old holds released and new holds taken in one transaction; on any
 *  failure the original booking is untouched. Venue change updates only the site
 *  segment of the reference (D1). A Confirmed booking moved within 48 h reverts
 *  to Pending Validation and the VLM is notified. */
export async function amendBooking(
  bookingId: string,
  user: SessionUser,
  input: AmendBookingInput,
) {
  if (!input.supplierContact || !input.supplierContact.trim()) {
    throw new BookingError("Supplier phone number is required.");
  }

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new BookingError("Booking not found.");
  if (!ACTIVE_STATUSES.includes(booking.status as BookingStatus)) {
    throw new BookingError("Only pending or confirmed bookings can be amended.");
  }
  if (booking.slotStart.getTime() <= Date.now()) {
    throw new BookingError("Cannot amend at or after the slot start.");
  }

  const venue = await prisma.venue.findUnique({ where: { id: input.venueId } });
  if (!venue || venue.status !== "active") throw new BookingError("Venue is not active.");

  const compound = await prisma.compound.findFirst({
    where: { id: input.compoundId, venueId: input.venueId },
  });
  const route = await prisma.compoundGate.findFirst({
    where: { compoundId: input.compoundId, gateId: input.gateId },
    include: { gate: true },
  });
  if (!compound || !route || route.gate.venueId !== input.venueId) {
    throw new BookingError("Invalid compound/gate combination.");
  }

  const operatingDay = await prisma.operatingDay.findUnique({
    where: { venueId_date: { venueId: input.venueId, date: input.serviceDate } },
  });
  if (!operatingDay || !operatingDay.active) {
    throw new BookingError("Venue is closed on the selected date.");
  }

  const duration = venue.defaultSlotDurationMinutes;
  const { slotStartMinutes: startMin, slotEndMinutes: endMin } = input;
  const total = endMin - startMin;
  if (total <= 0) throw new BookingError("Select at least one slot.");
  if (total > MAX_BOOKING_MINUTES) throw new BookingError("Cumulative duration exceeds the 2-hour limit.");
  if (total % duration !== 0 || startMin % duration !== 0) throw new BookingError("Slot selection is misaligned.");
  if (startMin < hmToMinutes(operatingDay.openTime) || endMin > hmToMinutes(operatingDay.closeTime)) {
    throw new BookingError("Selected window is outside operating hours.");
  }

  const slotStart = atMinutes(input.serviceDate, startMin);
  const slotEnd = atMinutes(input.serviceDate, endMin);
  if (slotStart.getTime() <= Date.now()) {
    throw new BookingError("Selected slot has already started. Please pick a later slot.");
  }
  const slotStarts: Date[] = [];
  for (let m = startMin; m < endMin; m += duration) slotStarts.push(atMinutes(input.serviceDate, m));

  const previousStatus = booking.status as BookingStatus;
  const hoursUntil = (slotStart.getTime() - Date.now()) / 3_600_000;
  // Pending stays Pending; Confirmed stays Confirmed only if still >48h out.
  const newStatus: BookingStatus =
    previousStatus === "Confirmed" && hoursUntil <= AUTO_CONFIRM_THRESHOLD_HOURS
      ? "PendingValidation"
      : previousStatus;

  const reference = formatReference(venue.siteCode, booking.refNumber);

  const detail = JSON.stringify({
    previousVenue: booking.siteCode,
    newVenue: venue.siteCode,
    previousDate: booking.serviceDate.toISOString().slice(0, 10),
    newDate: input.serviceDate.toISOString().slice(0, 10),
    previousWindow: `${booking.slotStart.toISOString()}→${booking.slotEnd.toISOString()}`,
    newWindow: `${slotStart.toISOString()}→${slotEnd.toISOString()}`,
  });

  const updated = await prisma
    .$transaction(async (tx) => {
      // Release the old holds, then take the new ones (atomic swap).
      await tx.slotHold.deleteMany({ where: { bookingId } });
      for (const s of slotStarts) {
        await tx.slotHold.create({
          data: { venueId: input.venueId, slotStart: s, bookingId },
        });
      }
      const b = await tx.booking.update({
        where: { id: bookingId },
        data: {
          reference,
          siteCode: venue.siteCode,
          type: input.type,
          status: newStatus,
          supplierContact: input.supplierContact,
          transporterName: input.transporterName,
          transporterContact: input.transporterContact,
          vehicleType: input.vehicleType,
          merchandiseType: input.merchandiseType,
          packagingType: input.packagingType,
          quantity: input.quantity,
          weightKg: input.weightKg,
          volumeM3: input.volumeM3,
          venueId: input.venueId,
          compoundId: input.compoundId,
          gateId: input.gateId,
          serviceDate: input.serviceDate,
          slotStart,
          slotEnd,
          comments: input.comments,
        },
      });
      await tx.bookingAuditEntry.create({
        data: {
          bookingId,
          userId: user.id,
          action: "amended",
          previousStatus,
          newStatus,
          detail,
        },
      });
      return b;
    })
    .catch((e: unknown) => {
      if (typeof e === "object" && e && "code" in e && (e as { code: string }).code === "P2002") {
        throw new BookingError("One of the selected slots was just taken. Please pick another.");
      }
      throw e;
    });

  // Reverted to Pending Validation → notify the venue's VLM(s) for revalidation.
  if (previousStatus === "Confirmed" && newStatus === "PendingValidation") {
    await notifyVenueVlms(input.venueId, "vlm_revalidation", { reference: updated.reference });
  }

  log.info("booking.amended", { bookingId, previousStatus, newStatus, userId: user.id });
  return updated;
}

async function notifyCancellation(bookingId: string, reason?: string, actorRole?: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { createdBy: true },
  });
  if (!booking) return;
  // Booking Cancelled (any path) → supplier gets in-app + email incl. the reason (spec §14).
  const payload = { reference: booking.reference, reason: reason ?? null };
  await notifications.send({
    channel: "email",
    recipient: booking.createdBy.email,
    template: "booking_cancelled",
    payload,
  });
  await notifications.send({
    channel: "inApp",
    recipient: booking.createdBy.email,
    template: "booking_cancelled",
    payload,
  });
  // Supplier-initiated cancellation → also notify the venue's VLM(s) (spec §14).
  if (actorRole === "supplier") {
    await notifyVenueVlms(booking.venueId, "vlm_supplier_cancelled", payload);
  }
}

/** Time-driven lifecycle sweep (spec §12): auto-cancel unvalidated pending
 *  bookings whose slot has passed, and expire confirmed bookings 1h after the
 *  window ends. Intended to be called on dashboard loads and/or a scheduler. */
export async function runLifecycleSweep(): Promise<void> {
  const now = Date.now();

  const stalePending = await prisma.booking.findMany({
    where: { status: "PendingValidation", slotStart: { lte: new Date(now) } },
    select: { id: true, status: true },
  });
  for (const b of stalePending) {
    await prisma.$transaction(async (tx) => {
      await tx.booking.update({ where: { id: b.id }, data: { status: "Cancelled" } });
      await tx.slotHold.deleteMany({ where: { bookingId: b.id } });
    });
    await writeAudit(b.id, null, "statusChanged", b.status, "Cancelled", "not validated before slot");
    await notifyCancellation(b.id, "not validated before slot");
  }

  const graceMs = 60 * 60_000;
  const toExpire = await prisma.booking.findMany({
    where: { status: "Confirmed", slotEnd: { lte: new Date(now - graceMs) } },
    select: { id: true, status: true },
  });
  for (const b of toExpire) {
    await prisma.$transaction(async (tx) => {
      await tx.booking.update({ where: { id: b.id }, data: { status: "Expired" } });
      await tx.slotHold.deleteMany({ where: { bookingId: b.id } });
    });
    await writeAudit(b.id, null, "statusChanged", b.status, "Expired");
  }

  if (stalePending.length || toExpire.length) {
    log.info("lifecycle.sweep", { autoCancelled: stalePending.length, expired: toExpire.length });
  }
}
