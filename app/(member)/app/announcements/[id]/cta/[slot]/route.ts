import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { recordAnnouncementCtaClick } from "@/lib/announcements/cta";
import { AuthDeniedError } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; slot: string }> },
) {
  const { id, slot } = await params;
  const session = await auth();
  const claims = session?.sessionId ? await loadSession(session.sessionId) : null;
  try {
    const destination = await recordAnnouncementCtaClick(claims, id, slot);
    if (!destination) {
      return new NextResponse(null, { status: 404 });
    }
    if (destination.startsWith("/")) {
      return NextResponse.redirect(new URL(destination, request.url), 302);
    }
    return NextResponse.redirect(destination, 302);
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      return NextResponse.redirect(new URL("/login", request.url), 302);
    }
    throw error;
  }
}
