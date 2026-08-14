import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

export const { auth: middleware } = NextAuth(authConfig);

// Layer 1: session cookie on /app and /admin. mfa_satisfied is on the
// sessions row and is applied after loadSession in the admin layout
// (Edge middleware cannot import Prisma).
export const config = {
  matcher: ["/app", "/app/:path*", "/admin", "/admin/:path*"],
};
