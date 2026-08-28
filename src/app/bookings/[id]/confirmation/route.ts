import { getSessionUser, canAccessVenue } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getLang } from "@/lib/lang";
import { buildConfirmationPdf } from "@/lib/pdf";
import type { BookingStatus } from "@/lib/constants";

// Downloadable / attachable booking-confirmation PDF (spec §14).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { venue: true, compound: true, gate: true },
  });
  if (!booking) return new Response("Not found", { status: 404 });

  // Authorization: owner (supplier) or venue-scoped VLM/Admin (spec §4).
  const allowed =
    (user.role === "supplier" && booking.createdById === user.id) ||
    ((user.role === "vlm" || user.role === "admin" || user.role === "viewer") &&
      canAccessVenue(user, booking.venueId));
  if (!allowed) return new Response("Forbidden", { status: 403 });

  const lang = await getLang();
  const bytes = await buildConfirmationPdf(
    {
      reference: booking.reference,
      type: booking.type as "delivery" | "collection",
      status: booking.status as BookingStatus,
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

  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${booking.reference}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
