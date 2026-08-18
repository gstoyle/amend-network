import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { EventForm, type EventFormState } from "@/components/event-form";
import { clientIpFromHeaders } from "@/lib/auth/credentials";
import { AuthDeniedError, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { EVENT_STAFF_ROLES, createEvent } from "@/lib/events/publish";

async function loadClaims() {
  const session = await auth();
  return session?.sessionId ? await loadSession(session.sessionId) : null;
}

function denyOrThrow(error: unknown): never {
  if (error instanceof AuthDeniedError) {
    redirect("/login");
  }
  throw error;
}

async function createAction(
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  "use server";
  const requestHeaders = await headers();
  try {
    const result = await createEvent(await loadClaims(), {
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      visibility: formData.getAll("visibility").map(String).filter((value) => value.length > 0),
      startsAt: String(formData.get("startsAt") ?? ""),
      endsAt: String(formData.get("endsAt") ?? ""),
      timezoneHint: String(formData.get("timezoneHint") ?? ""),
      location: String(formData.get("location") ?? ""),
      isVirtual: formData.get("isVirtual") === "true",
      joinUrl: String(formData.get("joinUrl") ?? ""),
      capacity: String(formData.get("capacity") ?? ""),
      ip: clientIpFromHeaders(requestHeaders),
      userAgent: requestHeaders.get("user-agent") ?? "unknown",
    });
    if (!result.ok) {
      return { error: result.error };
    }
  } catch (error) {
    denyOrThrow(error);
  }
  revalidatePath("/admin/events");
  redirect("/admin/events");
}

export default async function NewEventPage() {
  const claims = await loadClaims();
  try {
    requireRole(claims, { admin: [...EVENT_STAFF_ROLES], mfa: true });
  } catch (error) {
    denyOrThrow(error);
  }
  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-2xl font-medium text-foreground">New event</h1>
      <EventForm action={createAction} submitLabel="Publish" />
    </div>
  );
}
