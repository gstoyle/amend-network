import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { AuthDeniedError } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { grantDownload } from "@/lib/resources/download";

function requestIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first && first.length > 0 ? first : "127.0.0.1";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  const claims = session?.sessionId ? await loadSession(session.sessionId) : null;
  try {
    const url = await grantDownload(claims, id, {
      ip: requestIp(request),
      userAgent: request.headers.get("user-agent") ?? "unknown",
    });
    if (!url) {
      return new NextResponse(null, { status: 404 });
    }
    return NextResponse.redirect(url, 302);
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      return NextResponse.redirect(new URL("/login", request.url), 302);
    }
    throw error;
  }
}
