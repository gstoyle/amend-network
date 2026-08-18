import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import { env } from "@/lib/env";

export type ResetEmailInput = {
  to: string;
  resetUrl: string;
};

export type LifecycleEmailKind =
  | "invite"
  | "self_registration_confirmation"
  | "admin_pending_alert"
  | "welcome"
  | "set_password"
  | "registration_denied"
  | "invite_expiring_soon"
  | "invite_expired";

export type EventEmailKind =
  | "event_time_changed"
  | "event_cancelled"
  | "event_yes_invite"
  | "event_reminder";

export type LifecycleEmailInput = {
  kind: LifecycleEmailKind;
  to: string;
  vars?: Record<string, string>;
};

export type EventEmailInput = {
  kind: EventEmailKind;
  to: string;
  vars?: Record<string, string>;
};

function messageText(resetUrl: string): string {
  return `Use this link to reset your password. It expires in 60 minutes.\n${resetUrl}`;
}

function lifecycleCopy(kind: LifecycleEmailKind, vars: Record<string, string>): { subject: string; text: string } {
  switch (kind) {
    case "invite":
      return {
        subject: "You are invited to the Amend member network",
        text: vars.text ?? `You have 14 days to complete registration.\n${vars.link ?? ""}`,
      };
    case "self_registration_confirmation":
      return {
        subject: "We received your request",
        text: "If this email is eligible, you will receive further instructions.",
      };
    case "admin_pending_alert":
      return {
        subject: "New pending registration",
        text: "A new registration is waiting for review.",
      };
    case "welcome":
      return {
        subject: "You are in",
        text: "Your membership is active. You can sign in with the password you set.",
      };
    case "set_password":
      return {
        subject: "Set your password",
        text: `Use this link to set your password. It expires in 60 minutes.\n${vars.link ?? ""}`,
      };
    case "registration_denied":
      return {
        subject: "Registration update",
        text: "We are unable to approve this request at this time.",
      };
    case "invite_expiring_soon":
      return {
        subject: "Invitation expiring soon",
        text: `This invitation expires in 3 days.\n${vars.link ?? ""}`,
      };
    case "invite_expired":
      return {
        subject: "Invitation expired",
        text: "An invitation expired unused.",
      };
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function eventCopy(kind: EventEmailKind, vars: Record<string, string>): { subject: string; text: string } {
  const title = vars.title ?? "An event";
  const message = vars.message?.trim() ?? "";
  const starts = vars.startsAt ?? "";
  const location = vars.location ?? "";
  switch (kind) {
    case "event_time_changed":
      return {
        subject: `Event time updated: ${title}`,
        text: [
          `The time for ${title} has changed.`,
          starts ? `New start: ${starts}` : "",
          message,
        ]
          .filter((line) => line.length > 0)
          .join("\n"),
      };
    case "event_cancelled":
      return {
        subject: `Event cancelled: ${title}`,
        text: `${title} has been cancelled.`,
      };
    case "event_yes_invite":
      return {
        subject: `Calendar invite: ${title}`,
        text: [
          `You are confirmed for ${title}.`,
          starts ? `Starts: ${starts}` : "",
          location ? `Location: ${location}` : "",
          vars.joinUrl ? `Join: ${vars.joinUrl}` : "",
        ]
          .filter((line) => line.length > 0)
          .join("\n"),
      };
    case "event_reminder":
      return {
        subject: `Reminder: ${title} is tomorrow`,
        text: [`${title} starts in 24 hours.`, starts ? `Starts: ${starts}` : ""]
          .filter((line) => line.length > 0)
          .join("\n"),
      };
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

async function sendMail(payload: { to: string; subject: string; text: string }): Promise<void> {
  const settings = env();
  const message = {
    from: "Amend <noreply@local>",
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
  };

  switch (settings.EMAIL_TRANSPORT) {
    case "json": {
      const transporter = nodemailer.createTransport({ jsonTransport: true });
      const info = await transporter.sendMail(message);
      const dir = settings.EMAIL_JSON_DIR ?? ".tmp/mail";
      await mkdir(dir, { recursive: true });
      const body = typeof info.message === "string" ? info.message : JSON.stringify(info.message);
      await writeFile(join(dir, `${Date.now()}-${randomUUID()}.json`), body);
      return;
    }
    case "smtp": {
      const transporter = nodemailer.createTransport({
        host: settings.SMTP_HOST,
        port: settings.SMTP_PORT ?? 1025,
        secure: false,
      });
      await transporter.sendMail(message);
      return;
    }
    default: {
      const _exhaustive: never = settings.EMAIL_TRANSPORT;
      return _exhaustive;
    }
  }
}

export async function sendResetEmail(input: ResetEmailInput): Promise<void> {
  await sendMail({
    to: input.to,
    subject: "Password reset",
    text: messageText(input.resetUrl),
  });
}

export async function sendLifecycleEmail(input: LifecycleEmailInput): Promise<void> {
  const copy = lifecycleCopy(input.kind, input.vars ?? {});
  await sendMail({ to: input.to, subject: copy.subject, text: copy.text });
}

export async function sendEventEmail(input: EventEmailInput): Promise<void> {
  const copy = eventCopy(input.kind, input.vars ?? {});
  await sendMail({ to: input.to, subject: copy.subject, text: copy.text });
}
