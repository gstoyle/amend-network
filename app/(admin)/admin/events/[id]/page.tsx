import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { EventForm, type EventFormState } from "@/components/event-form";
import { Button } from "@/components/ui/button";
import { clientIpFromHeaders } from "@/lib/auth/credentials";
import { AuthDeniedError, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { cancelEvent } from "@/lib/events/cancel";
import { updateEvent } from "@/lib/events/edit";
import { EVENT_STAFF_ROLES, getAdminEvent } from "@/lib/events/publish";

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

function toLocalInput(value: Date): string {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

async function saveAction(
  id: string,
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  "use server";
  const requestHeaders = await headers();
  try {
    const result = await updateEvent(await loadClaims(), id, {
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
      notifyRsvps: formData.get("notifyRsvps") === "true",
      notifyMessage: String(formData.get("notifyMessage") ?? ""),
      confirmCapacityShrink: formData.get("confirmCapacityShrink") === "true",
    });
    if (!result.ok) {
      return { error: result.error };
    }
  } catch (error) {
    denyOrThrow(error);
  }
  revalidatePath("/admin/events");
  revalidatePath("/app/events");
  revalidatePath("/app");
  redirect("/admin/events");
}

async function cancelAction(id: string): Promise<void> {
  "use server";
  const requestHeaders = await headers();
  try {
    await cancelEvent(await loadClaims(), id, {
      ip: clientIpFromHeaders(requestHeaders),
      userAgent: requestHeaders.get("user-agent") ?? "unknown",
    });
  } catch (error) {
    denyOrThrow(error);
  }
  revalidatePath("/admin/events");
  revalidatePath("/app/events");
  revalidatePath("/app");
  redirect("/admin/events");
}

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const claims = await loadClaims();
  let item;
  try {
    requireRole(claims, { admin: [...EVENT_STAFF_ROLES], mfa: true });
    item = await getAdminEvent(claims, id);
  } catch (error) {
    denyOrThrow(error);
  }
  if (!item) {
    notFound();
  }
  const boundSave = saveAction.bind(null, id);
  const boundCancel = cancelAction.bind(null, id);
  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-2xl font-medium text-foreground">Edit event</h1>
      {item.cancelledAt ? <p className="text-foreground">This event is cancelled.</p> : null}
      <EventForm
        action={boundSave}
        capacityConfirm
        initial={{
          title: item.title,
          description: item.description,
          visibility: item.visibility,
          startsAt: toLocalInput(item.startsAt),
          endsAt: toLocalInput(item.endsAt),
          timezoneHint: item.timezoneHint ?? "",
          location: item.location ?? "",
          isVirtual: item.isVirtual,
          joinUrl: item.joinUrl ?? "",
          capacity: item.capacity !== null ? String(item.capacity) : "",
        }}
        notifyRsvps={item.rsvpCount > 0}
        submitLabel="Save"
      />
      {item.cancelledAt ? null : (
        <form action={boundCancel}>
          <Button type="submit" variant="destructive">
            Cancel event
          </Button>
        </form>
      )}
    </div>
  );
}
