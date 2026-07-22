import { prisma } from "./db";

// Notification provider interface (D7). In dev/test every message is written to
// the NotificationOutbox and logged — no real email/SMS leaves non-prod.
// A production adapter would implement `send` against a real provider.

export type NotificationChannel = "email" | "sms" | "inApp";

export interface OutboundMessage {
  channel: NotificationChannel;
  recipient: string;
  template: string;
  payload: Record<string, unknown>;
}

export interface NotificationProvider {
  send(message: OutboundMessage): Promise<void>;
}

class StubProvider implements NotificationProvider {
  async send(message: OutboundMessage): Promise<void> {
    await prisma.notificationOutbox.create({
      data: {
        channel: message.channel,
        recipient: message.recipient,
        template: message.template,
        payload: JSON.stringify(message.payload),
        status: "stubbed",
      },
    });
    // Structured, secret-free log (spec §19).
    console.log(
      JSON.stringify({
        evt: "notification.stubbed",
        channel: message.channel,
        template: message.template,
        recipient: message.recipient,
      }),
    );
  }
}

export const notifications: NotificationProvider = new StubProvider();
