import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { SESSION_COOKIE, SESSION_IDLE_MINUTES, type Role } from "./constants";
import { log } from "./logger";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  venueIds: string[]; // assigned venues (VLM). Empty for supplier/admin.
}

function newExpiry(): Date {
  return new Date(Date.now() + SESSION_IDLE_MINUTES * 60_000);
}

/** Create a server-side session and set the httpOnly cookie. */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  await prisma.session.create({
    data: { token, userId, expiresAt: newExpiry() },
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_IDLE_MINUTES * 60,
  });
}

/** Resolve the current user from the session cookie, applying a sliding
 *  30-minute inactivity timeout. Returns null when unauthenticated. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      user: { include: { venueAssignments: true } },
    },
  });
  if (!session) return null;

  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  if (session.user.status !== "active") return null;

  // Slide the inactivity window forward.
  await prisma.session.update({
    where: { id: session.id },
    data: { expiresAt: newExpiry() },
  });

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role as Role,
    venueIds: session.user.venueAssignments.map((a) => a.venueId),
  };
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
    store.delete(SESSION_COOKIE);
  }
}

/** Redirect to /login when unauthenticated; otherwise return the user. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    log.warn("authz.denied", { userId: user.id, role: user.role, need: roles });
    redirect("/");
  }
  return user;
}

/** Server-side venue-scope guard for VLMs (spec §4). Admins see all venues. */
export function canAccessVenue(user: SessionUser, venueId: string): boolean {
  if (user.role === "admin") return true;
  if (user.role === "vlm") return user.venueIds.includes(venueId);
  return false;
}

export function assertVenueAccess(user: SessionUser, venueId: string): void {
  if (!canAccessVenue(user, venueId)) {
    log.warn("authz.venue_denied", { userId: user.id, venueId });
    throw new Error("Forbidden: venue out of scope");
  }
}
