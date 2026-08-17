import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { AuthDeniedError } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { grantFile } from "@/lib/resources/download";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  const claims = session?.sessionId ? await loadSession(session.sessionId) : null;
  try {
    const url = await grantFile(claims, id);
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
