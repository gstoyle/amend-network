import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import { env } from "@/lib/env";

export type ResetEmailInput = {
  to: string;
  resetUrl: string;
};

function messageText(resetUrl: string): string {
  return `Use this link to reset your password. It expires in 60 minutes.\n${resetUrl}`;
}

export async function sendResetEmail(input: ResetEmailInput): Promise<void> {
  const settings = env();
  const payload = {
    from: "Amend <noreply@local>",
    to: input.to,
    subject: "Password reset",
    text: messageText(input.resetUrl),
  };

  switch (settings.EMAIL_TRANSPORT) {
    case "json": {
      const transporter = nodemailer.createTransport({ jsonTransport: true });
      const info = await transporter.sendMail(payload);
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
      await transporter.sendMail(payload);
      return;
    }
    default: {
      const _exhaustive: never = settings.EMAIL_TRANSPORT;
      return _exhaustive;
    }
  }
}
