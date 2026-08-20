import { headers } from "next/headers";
import { clientIpFromHeaders } from "@/lib/auth/credentials";
import type { ForumWriteMeta } from "@/lib/forum/write";

export async function forumWriteMeta(): Promise<ForumWriteMeta> {
  const requestHeaders = await headers();
  return {
    ip: clientIpFromHeaders(requestHeaders),
    userAgent: requestHeaders.get("user-agent") ?? "unknown",
  };
}
