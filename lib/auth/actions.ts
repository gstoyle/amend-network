"use server";

import { headers } from "next/headers";
import { AuthError } from "next-auth";
import { z } from "zod";
import { auth, signIn, signOut } from "@/auth";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import { clientIpFromHeaders } from "@/lib/auth/credentials";
import { loadSession, logoutSession } from "@/lib/auth/session";

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
