"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword, validatePasswordPolicy } from "@/lib/password";
import { OTP_CHANNELS, type OtpChannel, type Role } from "@/lib/constants";
import { log } from "@/lib/logger";

type Result = { ok: boolean; error?: string };

/** Change own password (§5, §15.2) — verifies the current password, enforces
 *  the role-based complexity policy, then clears the must-change flag. */
export async function changePasswordAction(
  currentPassword: string,
  newPassword: string,
): Promise<Result> {
  const sessionUser = await requireUser();
  const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
  if (!user) return { ok: false, error: "Not found." };

  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) return { ok: false, error: "Current password is incorrect." };

  const policyError = validatePasswordPolicy(newPassword, user.role as Role);
  if (policyError) return { ok: false, error: policyError };

  const sameAsOld = await verifyPassword(newPassword, user.passwordHash);
  if (sameAsOld) return { ok: false, error: "New password must differ from the current one." };

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: false },
  });
  log.info("user.password_changed", { userId: user.id });
  revalidatePath("/settings");
  return { ok: true };
}

/** Update own contact details and preferred OTP channel (§5, §15.2). */
export async function updateContactAction(
  phone: string,
  otpChannel: OtpChannel,
): Promise<Result> {
  const sessionUser = await requireUser();
  if (!OTP_CHANNELS.includes(otpChannel)) return { ok: false, error: "Invalid channel." };
  const trimmed = phone.trim();
  if (otpChannel === "sms" && !trimmed) {
    return { ok: false, error: "A phone number is required for SMS." };
  }
  await prisma.user.update({
    where: { id: sessionUser.id },
    data: { phone: trimmed || null, otpChannel },
  });
  log.info("user.contact_updated", { userId: sessionUser.id, otpChannel });
  revalidatePath("/settings");
  return { ok: true };
}
