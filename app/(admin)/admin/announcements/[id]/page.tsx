import Link from "next/link";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  AnnouncementForm,
  type AnnouncementFormState,
} from "@/components/announcement-form";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cardClassName } from "@/components/ui/card";
import { updateAnnouncement, withdrawAnnouncement } from "@/lib/announcements/edit";
import { getAdminAnnouncement } from "@/lib/announcements/publish";
import { clientIpFromHeaders } from "@/lib/auth/credentials";
import { AuthDeniedError, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

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
  _prev: AnnouncementFormState,
  formData: FormData,
): Promise<AnnouncementFormState> {
  "use server";
  const requestHeaders = await headers();
  try {
    const result = await updateAnnouncement(await loadClaims(), id, {
      headline: String(formData.get("headline") ?? ""),
      body: String(formData.get("body") ?? ""),
      visibility: formData.getAll("visibility").map(String).filter((value) => value.length > 0),
      activatesAt: String(formData.get("activatesAt") ?? ""),
      expiresAt: String(formData.get("expiresAt") ?? ""),
      dismissible: formData.get("dismissible") === "true",
      ctaPrimaryLabel: String(formData.get("ctaPrimaryLabel") ?? ""),
      ctaPrimaryUrl: String(formData.get("ctaPrimaryUrl") ?? ""),
      ctaSecondaryLabel: String(formData.get("ctaSecondaryLabel") ?? ""),
      ctaSecondaryUrl: String(formData.get("ctaSecondaryUrl") ?? ""),
      ip: clientIpFromHeaders(requestHeaders),
      userAgent: requestHeaders.get("user-agent") ?? "unknown",
    });
    if (!result.ok) {
      return { error: result.error };
    }
  } catch (error) {
    denyOrThrow(error);
  }
  revalidatePath("/admin/announcements");
  revalidatePath("/app");
  redirect("/admin/announcements");
}

async function withdrawAction(id: string): Promise<void> {
  "use server";
  const requestHeaders = await headers();
  try {
    await withdrawAnnouncement(await loadClaims(), id, {
      ip: clientIpFromHeaders(requestHeaders),
      userAgent: requestHeaders.get("user-agent") ?? "unknown",
    });
  } catch (error) {
    denyOrThrow(error);
  }
  revalidatePath("/admin/announcements");
  revalidatePath("/app");
  redirect("/admin/announcements");
}

export default async function EditAnnouncementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const claims = await loadClaims();
  let item;
  try {
    requireRole(claims, { admin: ["admin", "super_admin"], mfa: true });
    item = await getAdminAnnouncement(claims, id);
  } catch (error) {
    denyOrThrow(error);
  }
  if (!item) {
    notFound();
  }
  const boundSave = saveAction.bind(null, id);
  const boundWithdraw = withdrawAction.bind(null, id);
  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <p>
        <Link
          className={cn(buttonVariants({ variant: "ghost" }), "px-0")}
          href="/admin/announcements"
        >
          Back to announcements
        </Link>
      </p>
      <PageHeader
        actions={item.deletedAt ? <Badge tone="support">Withdrawn</Badge> : null}
        description="Update the notice, audience, schedule, and optional member actions."
        eyebrow="Announcement management"
        title={item.headline}
      />
      <section className={cn(cardClassName, "p-4 lg:p-6")} aria-label="Announcement details">
        <AnnouncementForm
          action={boundSave}
          initial={{
            headline: item.headline,
            body: item.body,
            visibility: item.visibility,
            activatesAt: toLocalInput(item.activatesAt),
            expiresAt: toLocalInput(item.expiresAt),
            dismissible: item.dismissible,
            ctaPrimaryLabel: item.ctaPrimaryLabel ?? "",
            ctaPrimaryUrl: item.ctaPrimaryUrl ?? "",
            ctaSecondaryLabel: item.ctaSecondaryLabel ?? "",
            ctaSecondaryUrl: item.ctaSecondaryUrl ?? "",
          }}
          submitLabel="Save announcement"
        />
      </section>
      {item.deletedAt ? null : (
        <form action={boundWithdraw} className="border-t border-border pt-6">
          <Button type="submit" variant="destructive">
            Withdraw announcement
          </Button>
        </form>
      )}
    </div>
  );
}
