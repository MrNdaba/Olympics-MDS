"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { verifyOtp } from "@/lib/otp";
import { createSession } from "@/lib/auth";
import { MAX_FAILED_ATTEMPTS, RATE_LIMITS } from "@/lib/constants";
import { consumeRateLimit, clientIp } from "@/lib/rate-limit";
import { log } from "@/lib/logger";

const PENDING_COOKIE = "mds_pending";
const DEV_OTP_COOKIE = "mds_dev_otp";

export interface LoginState {
  error?: "invalid" | "locked" | "otp" | "rate";
}

export async function startLogin(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  // Rate limit login attempts per email + IP (spec §19).
  const ip = await clientIp();
  const limit = consumeRateLimit(`login:${email}:${ip}`, RATE_LIMITS.login.max, RATE_LIMITS.login.windowMs);
  if (!limit.ok) {
    log.warn("login.rate_limited", { email, ip });
    return { error: "rate" };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // Never reveal which factor failed (spec §19 safe error handling).
  if (!user || user.status === "deactivated") {
    log.warn("login.failed", { email, reason: "no_user" });
    return { error: "invalid" };
  }
  if (user.status === "locked") {
    log.warn("login.locked_attempt", { userId: user.id });
    return { error: "locked" };
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    const failedAttempts = user.failedAttempts + 1;
    const locked = failedAttempts >= MAX_FAILED_ATTEMPTS;
    await prisma.user.update({
      where: { id: user.id },
      data: { failedAttempts, status: locked ? "locked" : user.status },
    });
    log.warn("login.failed", { userId: user.id, reason: "bad_password", locked });
    return { error: locked ? "locked" : "invalid" };
  }

  await prisma.user.update({ where: { id: user.id }, data: { failedAttempts: 0 } });

  // OTP step temporarily disabled — create the session immediately after a valid
  // password. Re-enable by restoring the issueOtp + /login/otp redirect below.
  await createSession(user.id);
  log.info("login.success", { userId: user.id, otp: "skipped" });
  redirect("/");

  /* --- OTP flow (disabled) ---
  const channel = user.otpChannel as OtpChannel;
  const recipient = channel === "sms" ? user.phone ?? user.email : user.email;
  const { devCode } = await issueOtp(user.id, channel, recipient);

  const store = await cookies();
  store.set(PENDING_COOKIE, user.id, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 600,
  });
  if (devCode) {
    store.set(DEV_OTP_COOKIE, devCode, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: 600,
    });
  }
  log.info("login.otp_step", { userId: user.id });
  redirect("/login/otp");
  --- end OTP flow --- */
}

export async function verifyOtpAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const store = await cookies();
  const userId = store.get(PENDING_COOKIE)?.value;
  if (!userId) redirect("/login");

  // Rate limit OTP verification (spec §19).
  const otpLimit = consumeRateLimit(`otp:${userId}`, RATE_LIMITS.otp.max, RATE_LIMITS.otp.windowMs);
  if (!otpLimit.ok) {
    log.warn("otp.rate_limited", { userId });
    return { error: "rate" };
  }

  const code = String(formData.get("code") ?? "").trim();
  const ok = await verifyOtp(userId, code);
  if (!ok) {
    log.warn("otp.failed", { userId });
    return { error: "otp" };
  }

  await createSession(userId);
  store.delete(PENDING_COOKIE);
  store.delete(DEV_OTP_COOKIE);
  log.info("login.success", { userId });
  redirect("/");
}
