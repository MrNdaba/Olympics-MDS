import { prisma } from "./db";
import type { SessionUser } from "./auth";

/** Venues open for new bookings: active AND booking window open (§15.5). */
export async function getActiveVenues() {
  return prisma.venue.findMany({
    where: { status: "active", bookingWindowOpen: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, siteCode: true, city: true },
  });
}

/** Venues a user may manage: assigned venues for a VLM, all for an admin (§15.5). */
export async function getManagedVenues(user: SessionUser) {
  const where =
    user.role === "admin" ? {} : { id: { in: user.venueIds } };
  return prisma.venue.findMany({
    where,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      siteCode: true,
      city: true,
      status: true,
      bookingWindowOpen: true,
      defaultSlotDurationMinutes: true,
    },
  });
}

/** Operating-day records for a venue, chronological, each with its configured
 *  break periods (§10, §15.5; break slots item). */
export async function getVenueOperatingDays(venueId: string) {
  return prisma.operatingDay.findMany({
    where: { venueId },
    orderBy: { date: "asc" },
    select: {
      id: true,
      date: true,
      openTime: true,
      closeTime: true,
      active: true,
      breaks: {
        orderBy: { startTime: "asc" },
        select: { id: true, startTime: true, endTime: true, label: true },
      },
    },
  });
}

export interface RoutingCompound {
  id: string;
  department: string;
  label: string;
  gates: { id: string; label: string }[];
}

/** Cascading routing for one venue: compounds each with their permitted gates
 *  (spec §8). Single-gate compounds are auto-selected client-side. */
export async function getVenueRouting(venueId: string): Promise<RoutingCompound[]> {
  const compounds = await prisma.compound.findMany({
    where: { venueId },
    orderBy: [{ department: "asc" }, { label: "asc" }],
    include: { routes: { include: { gate: true } } },
  });
  return compounds.map((c) => ({
    id: c.id,
    department: c.department,
    label: c.label,
    gates: c.routes
      .map((r) => ({ id: r.gate.id, label: r.gate.label }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  }));
}

export interface VenueRoutingAdmin {
  compounds: { id: string; department: string; label: string }[];
  gates: { id: string; label: string }[];
  routes: { compoundId: string; gateId: string }[];
}

/** Full compound/gate/routing view for venue maintenance (spec §15.5). */
export async function getVenueRoutingAdmin(venueId: string): Promise<VenueRoutingAdmin> {
  const [compounds, gates, routes] = await Promise.all([
    prisma.compound.findMany({
      where: { venueId },
      orderBy: [{ department: "asc" }, { label: "asc" }],
      select: { id: true, department: true, label: true },
    }),
    prisma.gate.findMany({
      where: { venueId },
      orderBy: { label: "asc" },
      select: { id: true, label: true },
    }),
    prisma.compoundGate.findMany({
      where: { compound: { venueId } },
      select: { compoundId: true, gateId: true },
    }),
  ]);
  return { compounds, gates, routes };
}
