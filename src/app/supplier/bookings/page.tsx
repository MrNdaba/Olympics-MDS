import { requireRole } from "@/lib/auth";
import { getTranslations } from "@/lib/lang";
import { prisma } from "@/lib/db";
import { ACTIVE_STATUSES, type BookingStatus } from "@/lib/constants";
import { formatShortDate, formatWindow } from "@/lib/time";
import { TopBar, type NavItem } from "@/components/TopBar";
import { MyBookings, type BookingRow } from "@/components/MyBookings";
import { supplierNav } from "@/lib/nav";

export default async function SupplierBookingsPage() {
  const user = await requireRole("supplier");
  const { lang, t } = await getTranslations();

  const bookings = await prisma.booking.findMany({
    where: { createdById: user.id },
    include: { venue: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const now = new Date().getTime();
  const rows: BookingRow[] = bookings.map((b) => ({
    id: b.id,
    reference: b.reference,
    type: b.type,
    siteCode: b.siteCode,
    venueName: b.venue.name,
    dateDisplay: formatShortDate(b.serviceDate),
    window: formatWindow(b.slotStart, b.slotEnd),
    status: b.status,
    canCancel:
      ACTIVE_STATUSES.includes(b.status as BookingStatus) && b.slotStart.getTime() > now,
  }));

  const nav: NavItem[] = supplierNav("mine", t);

  return (
    <div style={{ minHeight: "100vh" }}>
      <TopBar user={user} lang={lang} t={t} nav={nav} />
      <main style={{ padding: 24, display: "flex", flexDirection: "column", gap: 22, maxWidth: 1320, margin: "0 auto" }}>
        <MyBookings t={t} rows={rows} />
      </main>
    </div>
  );
}
