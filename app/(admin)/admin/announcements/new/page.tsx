import Link from "next/link";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  AnnouncementForm,
  type AnnouncementFormState,
} from "@/components/announcement-form";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { formSurfaceClassName } from "@/components/ui/card";
import { createAnnouncement } from "@/lib/announcements/publish";
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

async function createAction(
  _prev: AnnouncementFormState,
  formData: FormData,
): Promise<AnnouncementFormState> {
  "use server";
  const requestHeaders = await headers();
  try {
    const result = await createAnnouncement(await loadClaims(), {
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

export default async function NewAnnouncementPage() {
  const claims = await loadClaims();
  try {
    requireRole(claims, { admin: ["admin", "super_admin"], mfa: true });
  } catch (error) {
    denyOrThrow(error);
  }
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
        description="Write a notice, choose its audience and schedule, and add optional action buttons."
        eyebrow="Announcement management"
        title="New announcement"
      />
      <section className={formSurfaceClassName} aria-label="Announcement details">
        <AnnouncementForm action={createAction} submitLabel="Publish announcement" />
      </section>
    </div>
  );
}
