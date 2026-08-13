import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  cookies: {
    sessionToken: {
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  callbacks: {
    jwt({ token, user }) {
      if (user && "sessionId" in user && typeof user.sessionId === "string") {
        return { sessionId: user.sessionId };
      }
      if (typeof token.sessionId === "string") {
        return { sessionId: token.sessionId };
      }
      return token;
    },
    session({ token, session }) {
      return {
        ...session,
        sessionId: typeof token.sessionId === "string" ? token.sessionId : undefined,
      };
    },
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname;
      const needsSession = path.startsWith("/app") || path.startsWith("/admin");
      if (!needsSession) {
        return true;
      }
      return Boolean(auth?.sessionId);
    },
  },
  providers: [],
} satisfies NextAuthConfig;
