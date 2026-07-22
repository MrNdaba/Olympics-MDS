import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser, assertVenueAccess } from "@/lib/auth";
import { getTranslations } from "@/lib/lang";
import { prisma } from "@/lib/db";
import { getActiveVenues } from "@/lib/venues";
import { ACTIVE_STATUSES, type BookingStatus, MASTER_DATA_CATEGORIES } from "@/lib/constants";
import { dayIso, hmOf, hmToMinutes } from "@/lib/time";
import { TopBar, type NavItem } from "@/components/TopBar";
import { AmendForm, type AmendInitial } from "@/components/AmendForm";

async function masterList(category: string): Promise<string[]> {
  const rows = await prisma.masterData.findMany({ where: { category, active: true }, orderBy: { label: "asc" } });
  return rows.map((r) => r.label);
}

export default async function EditBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { lang, t } = await getTranslations();
  const { id } = await params;

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) redirect("/");

  // Authorization: supplier owns it; VLM/Admin scoped to venue (spec §4).
  if (user.role === "supplier") {
    if (booking.createdById !== user.id) redirect("/supplier");
  } else if (user.role === "vlm" || user.role === "admin") {
    assertVenueAccess(user, booking.venueId);
  } else {
    redirect("/");
  }

  const backHref = user.role === "supplier" ? "/supplier" : "/vlm";
  const now = new Date().getTime();
  const amendable =
    ACTIVE_STATUSES.includes(booking.status as BookingStatus) && booking.slotStart.getTime() > now;

  const [venues, vehicleTypes, merchTypes, packTypes] = await Promise.all([
    getActiveVenues(),
    masterList(MASTER_DATA_CATEGORIES[0]),
    masterList(MASTER_DATA_CATEGORIES[1]),
    masterList(MASTER_DATA_CATEGORIES[2]),
  ]);

  const nav: NavItem[] = [];

  if (!amendable) {
    return (
      <div style={{ minHeight: "100vh" }}>
        <TopBar user={user} lang={lang} t={t} nav={nav} />
        <main style={{ padding: 24, maxWidth: 640, margin: "0 auto" }}>
          <div style={{ background: "#fff", border: "1px solid var(--border-card)", borderRadius: 10, padding: 24 }}>
            <p style={{ fontSize: 13, marginBottom: 12 }}>{t.notAmendable}</p>
            <Link href={backHref} style={{ color: "var(--blue)", fontWeight: 600, fontSize: 13 }}>← {t.back}</Link>
          </div>
        </main>
      </div>
    );
  }

  const initial: AmendInitial = {
    reference: booking.reference,
    type: booking.type as "delivery" | "collection",
    supplierContact: booking.supplierContact ?? "",
    transporterName: booking.transporterName,
    transporterContact: booking.transporterContact,
    vehicleType: booking.vehicleType,
    merchandiseType: booking.merchandiseType,
    packagingType: booking.packagingType ?? "",
    quantity: booking.quantity ?? "",
    weightKg: booking.weightKg != null ? String(booking.weightKg) : "",
    volumeM3: booking.volumeM3 != null ? String(booking.volumeM3) : "",
    venueId: booking.venueId,
    dateIso: dayIso(booking.serviceDate),
    compoundId: booking.compoundId,
    gateId: booking.gateId,
    startMinutes: hmToMinutes(hmOf(booking.slotStart)),
    endMinutes: hmToMinutes(hmOf(booking.slotEnd)),
    comments: booking.comments ?? "",
  };

  return (
    <div style={{ minHeight: "100vh" }}>
      <TopBar user={user} lang={lang} t={t} nav={nav} />
      <main style={{ padding: 24, maxWidth: 1320, margin: "0 auto" }}>
        <AmendForm
          t={t}
          lang={lang}
          bookingId={booking.id}
          initial={initial}
          venues={venues}
          vehicleTypes={vehicleTypes}
          merchTypes={merchTypes}
          packTypes={packTypes}
          supplierName={booking.supplierName}
          backHref={backHref}
        />
      </main>
    </div>
  );
}
