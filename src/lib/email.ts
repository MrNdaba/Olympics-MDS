import { prisma } from "./db";
import { log } from "./logger";

// Transactional email sender (spec §14, D7). When SMTP_* env vars are configured
// (works on Vercel and Azure App Service) a real email is sent via SMTP;
// otherwise — in dev/test — the message is recorded in the NotificationOutbox and
// logged, so no real message leaves a non-production environment.
//
// Required env for real delivery:
//   SMTP_HOST, SMTP_PORT, SMTP_FROM
// Optional: SMTP_SECURE ("true" for port 465), SMTP_USER, SMTP_PASS

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
}

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_FROM);
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  if (smtpConfigured()) {
    try {
      const nodemailer = await import("nodemailer");
      const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: process.env.SMTP_SECURE === "true",
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      });
      await transport.sendMail({
        from: process.env.SMTP_FROM,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
        attachments: message.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
        })),
      });
      log.info("email.sent", { to: message.to, subject: message.subject });
      return;
    } catch (e) {
      log.error("email.send_failed", { to: message.to, error: (e as Error).message });
      // Fall through so the intent is still recorded in the outbox.
    }
  }

  // Dev/test stub: record intent only, never send (D7).
  await prisma.notificationOutbox.create({
    data: {
      channel: "email",
      recipient: message.to,
      template: message.subject,
      payload: JSON.stringify({
        subject: message.subject,
        hasAttachment: Boolean(message.attachments?.length),
      }),
      status: smtpConfigured() ? "failed" : "stubbed",
    },
  });
  log.info("email.stubbed", { to: message.to, subject: message.subject });
}
