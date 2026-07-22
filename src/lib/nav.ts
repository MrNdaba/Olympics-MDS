import type { Dict } from "./i18n";

export interface NavItemData {
  href: string;
  label: string;
  active: boolean;
}

export type NavKey = "dashboard" | "bookings" | "users" | "masterData" | "venues";

/** Cross-venue admin navigation (spec §15.6–9). */
export function adminNav(active: NavKey, t: Dict): NavItemData[] {
  return [
    { href: "/vlm/dashboard", label: t.navDashboard, active: active === "dashboard" },
    { href: "/vlm", label: t.navBookings, active: active === "bookings" },
    { href: "/admin/users", label: t.navUsers, active: active === "users" },
    { href: "/admin/master-data", label: t.navMasterData, active: active === "masterData" },
    { href: "/admin/venues", label: t.navVenues, active: active === "venues" },
  ];
}

/** VLM navigation, assigned-venue scoped (spec §15.3–5). */
export function vlmNav(active: "bookings" | "dashboard" | "venue", t: Dict): NavItemData[] {
  return [
    { href: "/vlm", label: t.navBookings, active: active === "bookings" },
    { href: "/vlm/dashboard", label: t.navDashboard, active: active === "dashboard" },
    { href: "/vlm/venue", label: t.navVenue, active: active === "venue" },
  ];
}

/** Supplier navigation (spec §15.1–2). */
export function supplierNav(active: "new" | "mine", t: Dict): NavItemData[] {
  return [
    { href: "/supplier", label: t.navNew, active: active === "new" },
    { href: "/supplier/bookings", label: t.navMine, active: active === "mine" },
  ];
}

