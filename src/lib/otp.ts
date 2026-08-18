import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { OTP_VALIDITY_MINUTES, type OtpChannel } from "./constants";
import { notifications } from "./notifications";
import { log } from "./logger";

/** Issue a one-time 6-digit code (single use, 10-min validity) and dispatch it
 *  through the notification provider (email only — D2/§5, item #9). Returns
 *  the challenge id. The plaintext code is only returned in non-production so
 *  the demo login screen can display it; it is never logged. */
export async function issueOtp(
  userId: string,
  channel: OtpChannel,
  recipient: string,
): Promise<{ challengeId: string; devCode?: string }> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + OTP_VALIDITY_MINUTES * 60_000);

  // Invalidate any earlier unconsumed challenges for this user.
  await prisma.otpChallenge.updateMany({
    where: { userId, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const challenge = await prisma.otpChallenge.create({
    data: { userId, codeHash, channel, expiresAt },
  });

  await notifications.send({
    channel,
    recipient,
    template: "login_otp",
    payload: { expiresInMinutes: OTP_VALIDITY_MINUTES },
  });
  log.info("otp.issued", { userId, channel });

  return {
    challengeId: challenge.id,
    devCode: process.env.NODE_ENV !== "production" ? code : undefined,
  };
}

/** Verify an OTP for a user. Consumes the challenge on success. */
export async function verifyOtp(userId: string, code: string): Promise<boolean> {
  const challenge = await prisma.otpChallenge.findFirst({
    where: { userId, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge) return false;
  if (challenge.expiresAt.getTime() < Date.now()) return false;

  const ok = await bcrypt.compare(code, challenge.codeHash);
  if (ok) {
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });
  }
  return ok;
}
