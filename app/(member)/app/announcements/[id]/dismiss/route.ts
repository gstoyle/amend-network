import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { dismissAnnouncement } from "@/lib/announcements/dismiss";
import { AuthDeniedError } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  const claims = session?.sessionId ? await loadSession(session.sessionId) : null;
  try {
    const ok = await dismissAnnouncement(claims, id);
    if (!ok) {
      return new NextResponse(null, { status: 404 });
    }
    const referer = request.headers.get("referer");
    return NextResponse.redirect(referer && referer.length > 0 ? referer : new URL("/app", request.url), 303);
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      return NextResponse.redirect(new URL("/login", request.url), 302);
    }
    throw error;
  }
}
