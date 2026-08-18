import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { AuthDeniedError } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { setEventRsvp, type RsvpChoice } from "@/lib/events/rsvp";

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded && forwarded.length > 0 ? forwarded : "127.0.0.1";
}

function asChoice(value: FormDataEntryValue | null): RsvpChoice | null {
  switch (value) {
    case "yes":
    case "no":
    case "maybe":
      return value;
    default:
      return null;
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  const claims = session?.sessionId ? await loadSession(session.sessionId) : null;
  const form = await request.formData();
  const choice = asChoice(form.get("status"));
  const detailUrl = new URL(`/app/events/${id}`, request.url);
  try {
    if (!choice) {
      return NextResponse.redirect(detailUrl, 303);
    }
    const result = await setEventRsvp(claims, id, choice, {
      ip: clientIp(request),
      userAgent: request.headers.get("user-agent") ?? "unknown",
    });
    if (!result.ok) {
      return new NextResponse(null, { status: 404 });
    }
    return NextResponse.redirect(detailUrl, 303);
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      return NextResponse.redirect(new URL("/login", request.url), 302);
    }
    throw error;
  }
}
