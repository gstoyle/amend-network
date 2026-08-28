import Link from "next/link";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { ResourceForm, type ResourceFormState } from "@/components/resource-form";
import { buttonVariants } from "@/components/ui/button";
import { formSurfaceClassName } from "@/components/ui/card";
import { clientIpFromHeaders } from "@/lib/auth/credentials";
import { AuthDeniedError, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { mintIngestSlots, publishResource } from "@/lib/resources/publish";
import { cn } from "@/lib/utils";

async function loadClaims() {
  const session = await auth();
  return session?.sessionId ? await loadSession(session.sessionId) : null;
}

async function requestContext() {
  const requestHeaders = await headers();
  return {
    ip: clientIpFromHeaders(requestHeaders),
    userAgent: requestHeaders.get("user-agent") ?? "unknown",
  };
}

function denyOrThrow(error: unknown): never {
  if (error instanceof AuthDeniedError) {
    redirect("/login");
  }
  throw error;
}

async function mintAction(fileMimeType: string, thumbMimeType: string) {
  "use server";
  try {
    const slots = await mintIngestSlots(await loadClaims(), {
      fileMimeType,
      thumbMimeType,
    });
    return {
      ingestId: slots.ingestId,
      filePutUrl: slots.filePutUrl,
      thumbPutUrl: slots.thumbPutUrl,
    };
  } catch (error) {
    denyOrThrow(error);
  }
}

async function publishAction(
  _prev: ResourceFormState,
  formData: FormData,
): Promise<ResourceFormState> {
  "use server";
  const visibility = formData
    .getAll("visibility")
    .map((value) => String(value))
    .filter((value) => value.length > 0);
  const tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
  try {
    const result = await publishResource(await loadClaims(), {
      ingestId: String(formData.get("ingestId") ?? ""),
      title: String(formData.get("title") ?? ""),
      previewText: String(formData.get("previewText") ?? ""),
      sourceLabel: String(formData.get("sourceLabel") ?? ""),
      tags,
      visibility,
      fileMimeType: String(formData.get("fileMimeType") ?? ""),
      fileSizeBytes: Number(formData.get("fileSizeBytes") ?? 0),
      thumbMimeType: String(formData.get("thumbMimeType") ?? ""),
      ...(await requestContext()),
    });
    if (!result.ok) {
      return { error: result.error };
    }
  } catch (error) {
    denyOrThrow(error);
  }
  revalidatePath("/admin/resources");
  redirect("/admin/resources");
}

export default async function AdminResourceNewPage() {
  const claims = await loadClaims();
  try {
    requireRole(claims, { admin: ["admin", "super_admin"], mfa: true });
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      redirect("/login");
    }
    throw error;
  }

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <p>
        <Link
          className={cn(buttonVariants({ variant: "ghost" }), "px-0")}
          href="/admin/resources"
        >
          Back to resources
        </Link>
      </p>
      <PageHeader
        description="Add a library item, its member-facing summary, audience, and accessible thumbnail."
        eyebrow="Resource management"
        title="Publish a resource"
      />
      <section className={formSurfaceClassName} aria-label="Resource details">
        <ResourceForm mintAction={mintAction} publishAction={publishAction} />
      </section>
    </div>
  );
}
