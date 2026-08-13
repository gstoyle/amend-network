import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    sessionId?: string;
  }

  interface Session {
    sessionId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sessionId?: string;
  }
}
