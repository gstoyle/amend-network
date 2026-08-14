"use server";

import { headers } from "next/headers";
import { AuthError } from "next-auth";
import { z } from "zod";
import { auth, signIn, signOut } from "@/auth";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import { clientIpFromHeaders } from "@/lib/auth/credentials";
import { loadSession, logoutSession } from "@/lib/auth/session";
import { revokeOwnSession } from "@/lib/auth/session-actions";
import { AuthDeniedError, requireRole } from "@/lib/auth/requireRole";
import {
  completePasswordReset,
  requestPasswordReset,
} from "@/lib/auth/password-reset";

const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

export type LoginFormState = {
  error?: string;
};

export async function loginAction(
  _prev: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: AUTH_FAILURE_MESSAGE };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/app",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: AUTH_FAILURE_MESSAGE };
    }
    throw error;
  }

  return { error: AUTH_FAILURE_MESSAGE };
}

export async function logoutAction(): Promise<void> {
  const requestHeaders = await headers();
  const ip = clientIpFromHeaders(requestHeaders);
  const userAgent = requestHeaders.get("user-agent") ?? "unknown";
  const session = await auth();
  if (session?.sessionId) {
    const claims = await loadSession(session.sessionId);
    if (claims) {
      await logoutSession({
        sessionId: claims.sessionId,
        userId: claims.userId,
        ip,
        userAgent,
      });
    }
  }
  await signOut({ redirectTo: "/login" });
}

export type ResetRequestState = { success?: boolean };

export async function requestResetAction(
  _prev: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  const email = z.string().min(1).safeParse(formData.get("email"));
  const requestHeaders = await headers();
  if (email.success) {
    await requestPasswordReset({
      email: email.data,
      ip: clientIpFromHeaders(requestHeaders),
      userAgent: requestHeaders.get("user-agent") ?? "unknown",
    });
  }
  return { success: true };
}

export type ResetCompleteState = { error?: string; success?: boolean };

export async function completeResetAction(
  _prev: ResetCompleteState,
  formData: FormData,
): Promise<ResetCompleteState> {
  const parsed = z
    .object({
      token: z.string().min(1),
      password: z.string().min(12),
    })
    .safeParse({
      token: formData.get("token"),
      password: formData.get("password"),
    });
  if (!parsed.success) {
    return { error: AUTH_FAILURE_MESSAGE };
  }
  const requestHeaders = await headers();
  const result = await completePasswordReset({
    token: parsed.data.token,
    password: parsed.data.password,
    ip: clientIpFromHeaders(requestHeaders),
    userAgent: requestHeaders.get("user-agent") ?? "unknown",
  });
  if (!result.ok) {
    return { error: result.error };
  }
  return { success: true };
}

export async function revokeSessionAction(formData: FormData): Promise<void> {
  const sessionId = z.string().uuid().safeParse(formData.get("sessionId"));
  const requestHeaders = await headers();
  const session = await auth();
  const claims = session?.sessionId ? await loadSession(session.sessionId) : null;
  try {
    requireRole(claims);
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      return;
    }
    throw error;
  }
  if (!sessionId.success || !claims) {
    return;
  }
  await revokeOwnSession({
    sessionId: sessionId.data,
    userId: claims.userId,
    ip: clientIpFromHeaders(requestHeaders),
    userAgent: requestHeaders.get("user-agent") ?? "unknown",
  });
}
