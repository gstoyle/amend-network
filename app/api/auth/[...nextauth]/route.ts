import type { NextRequest } from "next/server";
import { handlers } from "@/auth";
import { asBrowserCloseSetCookie } from "@/lib/auth/session";

async function withBrowserCloseSessionCookie(response: Response): Promise<Response> {
  const setCookies = response.headers.getSetCookie();
  if (setCookies.length === 0) {
    return response;
  }
  const headers = new Headers(response.headers);
  headers.delete("set-cookie");
  for (const cookie of setCookies) {
    headers.append("set-cookie", asBrowserCloseSetCookie(cookie));
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function GET(request: NextRequest): Promise<Response> {
  return withBrowserCloseSessionCookie(await handlers.GET(request));
}

export async function POST(request: NextRequest): Promise<Response> {
  return withBrowserCloseSessionCookie(await handlers.POST(request));
}
