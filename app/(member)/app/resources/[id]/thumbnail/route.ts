import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { AuthDeniedError } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { grantThumbnail } from "@/lib/resources/list";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  const claims = session?.sessionId ? await loadSession(session.sessionId) : null;
  try {
    const url = await grantThumbnail(claims, id);
    if (!url) {
      return new NextResponse(null, { status: 404 });
    }
    return NextResponse.redirect(url, 302);
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      const login = new URL("/login", request.url);
      return NextResponse.redirect(login, 302);
    }
    throw error;
  }
}
