"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hashPassword, validatePasswordPolicy } from "@/lib/password";
import {
  MASTER_DATA_CATEGORIES,
  ROLES,
  USER_STATUSES,
  type MasterDataCategory,
  type Role,
  type UserStatus,
} from "@/lib/constants";
import { log } from "@/lib/logger";

type Result = { ok: boolean; error?: string };

// ── Users ─────────────────────────────────────────────────────────────────────
export interface CreateUserInput {
  email: string;
  name: string;
  role: Role;
  otpChannel: "email";
  phone?: string;
  password: string;
  venueIds: string[];
}

export async function createUserAction(input: CreateUserInput): Promise<Result> {
  const admin = await requireRole("admin");
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  const phone = input.phone?.trim() ?? "";
  if (!ROLES.includes(input.role)) return { ok: false, error: "Invalid role." };

  // Supplier accounts must carry a way to reach the driver/site contact —
  // email and phone are both mandatory (never silently create a partial
  // supplier account); other roles keep phone optional.
  const missing: string[] = [];
  if (!email) missing.push("email address");
  if (!name) missing.push("name");
  if (input.role === "supplier" && !phone) missing.push("phone number");
  if (missing.length > 0) {
    return { ok: false, error: `Missing required field${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.` };
  }

  const policyError = validatePasswordPolicy(input.password, input.role);
  if (policyError) return { ok: false, error: policyError };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { ok: false, error: "A user with this email already exists." };

  const passwordHash = await hashPassword(input.password);
  const venueIds = input.role === "vlm" ? input.venueIds : [];

  await prisma.user.create({
    data: {
      email,
      name,
      role: input.role,
      otpChannel: input.otpChannel,
      phone: phone || null,
      passwordHash,
      mustChangePassword: true,
      venueAssignments: { create: venueIds.map((venueId) => ({ venueId })) },
    },
  });
  log.info("admin.user_created", { by: admin.id, email, role: input.role });
  revalidatePath("/admin/users");
  return { ok: true };
}

export interface UpdateUserInput {
  userId: string;
  name: string;
  role: Role;
  otpChannel: "email";
  phone?: string;
  venueIds: string[];
}

export async function updateUserAction(input: UpdateUserInput): Promise<Result> {
  const admin = await requireRole("admin");
  const name = input.name.trim();
  const phone = input.phone?.trim() ?? "";
  if (!ROLES.includes(input.role)) return { ok: false, error: "Invalid role." };
  if (input.userId === admin.id && input.role !== "admin") {
    return { ok: false, error: "You cannot change your own role." };
  }

  const missing: string[] = [];
  if (!name) missing.push("name");
  if (input.role === "supplier" && !phone) missing.push("phone number");
  if (missing.length > 0) {
    return { ok: false, error: `Missing required field${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.` };
  }

  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) return { ok: false, error: "Not found." };

  const venueIds = input.role === "vlm" ? input.venueIds : [];

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: input.userId },
      data: {
        name,
        role: input.role,
        otpChannel: input.otpChannel,
        phone: phone || null,
      },
    });
    // Reset venue scoping to the new selection (VLM only).
    await tx.venueAssignment.deleteMany({ where: { userId: input.userId } });
    if (venueIds.length > 0) {
      await tx.venueAssignment.createMany({
        data: venueIds.map((venueId) => ({ userId: input.userId, venueId })),
      });
    }
  });
  log.info("admin.user_updated", { by: admin.id, userId: input.userId, role: input.role });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function setUserStatusAction(userId: string, status: UserStatus): Promise<Result> {
  const admin = await requireRole("admin");
  if (!USER_STATUSES.includes(status)) return { ok: false, error: "Invalid status." };
  if (userId === admin.id) return { ok: false, error: "You cannot change your own status." };
  await prisma.user.update({ where: { id: userId }, data: { status, failedAttempts: 0 } });
  log.info("admin.user_status", { by: admin.id, userId, status });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function resetUserPasswordAction(userId: string, newPassword: string): Promise<Result> {
  const admin = await requireRole("admin");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, error: "Not found." };
  const policyError = validatePasswordPolicy(newPassword, user.role as Role);
  if (policyError) return { ok: false, error: policyError };
  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: true, status: "active", failedAttempts: 0 },
  });
  log.info("admin.password_reset", { by: admin.id, userId });
  revalidatePath("/admin/users");
  return { ok: true };
}

// ── Master data ───────────────────────────────────────────────────────────────
export async function createMasterDataAction(
  category: MasterDataCategory,
  label: string,
): Promise<Result> {
  const admin = await requireRole("admin");
  if (!MASTER_DATA_CATEGORIES.includes(category)) return { ok: false, error: "Invalid category." };
  const value = label.trim();
  if (!value) return { ok: false, error: "Label is required." };
  const existing = await prisma.masterData.findUnique({
    where: { category_label: { category, label: value } },
  });
  if (existing) return { ok: false, error: "This entry already exists." };
  await prisma.masterData.create({ data: { category, label: value } });
  log.info("admin.masterdata_created", { by: admin.id, category });
  revalidatePath("/admin/master-data");
  return { ok: true };
}

export async function setMasterDataActiveAction(id: string, active: boolean): Promise<Result> {
  const admin = await requireRole("admin");
  await prisma.masterData.update({ where: { id }, data: { active } });
  log.info("admin.masterdata_active", { by: admin.id, id, active });
  revalidatePath("/admin/master-data");
  return { ok: true };
}

// ── Venues ────────────────────────────────────────────────────────────────────
export interface CreateVenueInput {
  name: string;
  siteCode: string;
  city: string;
  slotDuration: number;
}

export async function createVenueAction(input: CreateVenueInput): Promise<Result> {
  const admin = await requireRole("admin");
  const siteCode = input.siteCode.trim().toUpperCase();

  // No incomplete venue records (item #12): every field below must be present
  // and valid, named explicitly rather than silently defaulted.
  const missing: string[] = [];
  if (!input.name.trim()) missing.push("name");
  if (!siteCode) missing.push("site code");
  if (!input.city.trim()) missing.push("city");
  if (input.slotDuration === undefined || input.slotDuration === null || Number.isNaN(Number(input.slotDuration))) {
    missing.push("slot duration");
  }
  if (missing.length > 0) {
    return { ok: false, error: `Missing required field${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.` };
  }
  if (!/^[A-Z]{3}$/.test(siteCode)) return { ok: false, error: "Site code must be 3 letters." };
  const duration = Number(input.slotDuration);
  if (!Number.isFinite(duration) || duration < 5 || duration > 240) {
    return { ok: false, error: "Slot duration must be 5–240 min." };
  }

  const existing = await prisma.venue.findUnique({ where: { siteCode } });
  if (existing) return { ok: false, error: "A venue with this site code already exists." };

  await prisma.venue.create({
    data: {
      name: input.name.trim(),
      siteCode,
      city: input.city.trim(),
      defaultSlotDurationMinutes: duration,
      status: "active",
    },
  });
  log.info("admin.venue_created", { by: admin.id, siteCode });
  revalidatePath("/admin/venues");
  return { ok: true };
}

export async function setVenueStatusAction(venueId: string, status: "active" | "inactive"): Promise<Result> {
  const admin = await requireRole("admin");
  await prisma.venue.update({ where: { id: venueId }, data: { status } });
  log.info("admin.venue_status", { by: admin.id, venueId, status });
  revalidatePath("/admin/venues");
  return { ok: true };
}

export interface UpdateVenueInput {
  venueId: string;
  name: string;
  city: string;
  slotDuration: number;
}

// Site code is intentionally not editable here — it is embedded verbatim in
// every existing booking reference for this venue (OLY-{SITE}-{NNNNNN}), and
// renaming it after creation would desync those references from the venue's
// current code (see D1 in AGENTS.md). Retiring a code means deactivating the
// venue and creating a new one, not renaming this one.
export async function updateVenueAction(input: UpdateVenueInput): Promise<Result> {
  const admin = await requireRole("admin");
  const name = input.name.trim();
  const city = input.city.trim();
  if (!name || !city) return { ok: false, error: "Name and city are required." };
  const duration = Number(input.slotDuration);
  if (!Number.isFinite(duration) || duration < 5 || duration > 240) {
    return { ok: false, error: "Slot duration must be 5–240 min." };
  }

  const venue = await prisma.venue.findUnique({ where: { id: input.venueId } });
  if (!venue) return { ok: false, error: "Not found." };

  await prisma.venue.update({
    where: { id: input.venueId },
    data: { name, city, defaultSlotDurationMinutes: duration },
  });
  log.info("admin.venue_updated", { by: admin.id, venueId: input.venueId });
  revalidatePath("/admin/venues");
  revalidatePath("/vlm/venue");
  return { ok: true };
}
