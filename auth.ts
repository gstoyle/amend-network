import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import {
  authorizeCredentials,
  clientIpFromHeaders,
} from "@/lib/auth/credentials";
import { loadSession, logoutSession } from "@/lib/auth/session";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  events: {
    async signOut(message) {
      if (!("token" in message)) {
        return;
      }
      const sessionId = message.token?.sessionId;
      if (typeof sessionId !== "string") {
        return;
      }
      const claims = await loadSession(sessionId);
      if (!claims) {
        return;
      }
      await logoutSession({
        sessionId: claims.sessionId,
        userId: claims.userId,
        ip: "127.0.0.1",
        userAgent: "authjs-signout",
      });
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials, request) => {
        const email = typeof credentials?.email === "string" ? credentials.email : "";
        const password =
          typeof credentials?.password === "string" ? credentials.password : "";
        const result = await authorizeCredentials({
          email,
          password,
          ip: clientIpFromHeaders(request.headers),
          userAgent: request.headers.get("user-agent") ?? "unknown",
        });
        if (!result) {
          return null;
        }
        return { id: result.userId, sessionId: result.sessionId };
      },
    }),
  ],
});
