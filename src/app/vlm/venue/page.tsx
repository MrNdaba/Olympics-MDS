import { requireRole } from "@/lib/auth";
import { getTranslations } from "@/lib/lang";
import { getManagedVenues, getVenueOperatingDays, getVenueRoutingAdmin } from "@/lib/venues";
import { formatShortDate, dayIso } from "@/lib/time";
import { TopBar, type NavItem } from "@/components/TopBar";
import { adminNav, vlmNav } from "@/lib/nav";
import { VenueManagement, type ManagedVenue } from "@/components/vlm/VenueManagement";

export default async function VlmVenuePage() {
  const user = await requireRole("vlm", "admin", "viewer");
  const { lang, t } = await getTranslations();

  const managed = await getManagedVenues(user);
  const venues: ManagedVenue[] = await Promise.all(
    managed.map(async (v) => {
      const [days, routing] = await Promise.all([
        getVenueOperatingDays(v.id),
        getVenueRoutingAdmin(v.id),
      ]);
      return {
        id: v.id,
        name: v.name,
        siteCode: v.siteCode,
        city: v.city,
        status: v.status,
        bookingWindowOpen: v.bookingWindowOpen,
        slotDuration: v.defaultSlotDurationMinutes,
        days: days.map((d) => ({
          dateIso: dayIso(d.date),
          dateDisplay: formatShortDate(d.date),
          openTime: d.openTime,
          closeTime: d.closeTime,
          active: d.active,
        })),
        compounds: routing.compounds,
        gates: routing.gates,
        routes: routing.routes,
      };
    }),
  );

  const nav: NavItem[] =
    user.role === "admin" ? adminNav("venues", t) : vlmNav("venue", t);

  return (
    <div style={{ minHeight: "100vh" }}>
      <TopBar user={user} lang={lang} t={t} nav={nav} subtitle={t.venueMgmtTitle} />
      <main style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, maxWidth: 1360, margin: "0 auto" }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>{t.venueMgmtTitle}</h1>
          <p style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>{t.venueMgmtSub}</p>
        </div>
        <VenueManagement t={t} venues={venues} readOnly={user.role === "viewer"} />
      </main>
    </div>
  );
}
