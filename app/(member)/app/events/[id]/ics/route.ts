import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { AuthDeniedError } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { getEventIcs } from "@/lib/events/ics";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  const claims = session?.sessionId ? await loadSession(session.sessionId) : null;
  try {
    const file = await getEventIcs(claims, id);
    if (!file) {
      return new NextResponse(null, { status: 404 });
    }
    return new NextResponse(file.body, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${file.filename}"`,
      },
    });
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      return NextResponse.redirect(new URL("/login", request.url), 302);
    }
    throw error;
  }
}
