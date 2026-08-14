"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { clientIpFromHeaders } from "@/lib/auth/credentials";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import { completeMfaChallenge, completeMfaEnrollment } from "@/lib/auth/mfa";
import { loadSession } from "@/lib/auth/session";

const codeSchema = z.object({
  code: z.string().regex(/^\d{6}$/),
});

export type MfaFormState = {
  error?: string;
};

async function sessionForMfa(): Promise<{
  sessionId: string;
  userId: string;
  ip: string;
  userAgent: string;
} | null> {
  const session = await auth();
  if (!session?.sessionId) {
    return null;
  }
  const claims = await loadSession(session.sessionId);
  if (!claims) {
    return null;
  }
  const requestHeaders = await headers();
  return {
    sessionId: claims.sessionId,
    userId: claims.userId,
    ip: clientIpFromHeaders(requestHeaders),
    userAgent: requestHeaders.get("user-agent") ?? "unknown",
  };
}

export async function enrollMfaAction(
  _prev: MfaFormState,
  formData: FormData,
): Promise<MfaFormState> {
  const parsed = codeSchema.safeParse({ code: formData.get("code") });
  const context = await sessionForMfa();
  if (!parsed.success || !context) {
    return { error: AUTH_FAILURE_MESSAGE };
  }

  const result = await completeMfaEnrollment({
    ...context,
    code: parsed.data.code,
  });
  if (result.ok) {
    redirect("/admin");
  }
  return { error: result.error };
}

export async function challengeMfaAction(
  _prev: MfaFormState,
  formData: FormData,
): Promise<MfaFormState> {
  const parsed = codeSchema.safeParse({ code: formData.get("code") });
  const context = await sessionForMfa();
  if (!parsed.success || !context) {
    return { error: AUTH_FAILURE_MESSAGE };
  }

  const result = await completeMfaChallenge({
    ...context,
    code: parsed.data.code,
  });
  if (result.ok) {
    redirect("/admin");
  }
  return { error: result.error };
}
