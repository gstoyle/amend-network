import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { ResourceForm, type ResourceFormState } from "@/components/resource-form";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cardClassName } from "@/components/ui/card";
import { clientIpFromHeaders } from "@/lib/auth/credentials";
import { AuthDeniedError, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { getAdminResource, replaceResource, updateResource, withdrawResource } from "@/lib/resources/edit";
import { mintIngestSlots } from "@/lib/resources/publish";
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

async function saveAction(
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
  const resourceId = String(formData.get("resourceId") ?? "");
  const context = await requestContext();
  try {
    const claims = await loadClaims();
    const updated = await updateResource(claims, {
      resourceId,
      title: String(formData.get("title") ?? ""),
      previewText: String(formData.get("previewText") ?? ""),
      sourceLabel: String(formData.get("sourceLabel") ?? ""),
      tags,
      visibility,
      ...context,
    });
    if (!updated.ok) {
      return { error: updated.error };
    }
    const ingestId = String(formData.get("ingestId") ?? "");
    if (ingestId.length > 0) {
      const replaced = await replaceResource(claims, {
        resourceId,
        ingestId,
        fileMimeType: String(formData.get("fileMimeType") ?? ""),
        fileSizeBytes: Number(formData.get("fileSizeBytes") ?? 0),
        thumbMimeType: String(formData.get("thumbMimeType") ?? ""),
        ...context,
      });
      if (!replaced.ok) {
        return { error: replaced.error };
      }
    }
  } catch (error) {
    denyOrThrow(error);
  }
  revalidatePath("/admin/resources");
  revalidatePath(`/admin/resources/${resourceId}`);
  revalidatePath("/app/resources");
  return { message: "Saved." };
}

async function withdrawAction(formData: FormData): Promise<void> {
  "use server";
  const resourceId = String(formData.get("resourceId") ?? "");
  try {
    const result = await withdrawResource(await loadClaims(), {
      resourceId,
      ...(await requestContext()),
    });
    if (!result.ok) {
      redirect(`/admin/resources/${resourceId}`);
    }
  } catch (error) {
    denyOrThrow(error);
  }
  revalidatePath("/admin/resources");
  revalidatePath(`/admin/resources/${resourceId}`);
  revalidatePath("/app/resources");
  redirect(`/admin/resources/${resourceId}`);
}

export default async function AdminResourceEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const claims = await loadClaims();
  let resource;
  try {
    requireRole(claims, { admin: ["admin", "super_admin"], mfa: true });
    resource = await getAdminResource(claims, id);
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      redirect("/login");
    }
    throw error;
  }
  if (!resource) {
    notFound();
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
        actions={resource.deletedAt ? <Badge tone="support">Withdrawn</Badge> : null}
        description="Update the member-facing details, audience, or replace the file and thumbnail together."
        eyebrow="Resource management"
        title={resource.title}
      />
      {resource.deletedAt ? (
        <section className={cn(cardClassName, "border-dashed p-6")}>
          <h2 className="font-semibold text-foreground">This resource is withdrawn</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            It is no longer available in the member library.
          </p>
        </section>
      ) : (
        <>
          <section className={cn(cardClassName, "p-4 lg:p-6")} aria-label="Resource details">
            <ResourceForm
              initial={{
                id: resource.id,
                title: resource.title,
                previewText: resource.previewText,
                sourceLabel: resource.sourceLabel,
                tags: resource.tags,
                visibility: resource.visibility,
              }}
              mintAction={mintAction}
              saveAction={saveAction}
            />
          </section>
          <form action={withdrawAction} className="border-t border-border pt-6">
            <input name="resourceId" type="hidden" value={resource.id} />
            <Button type="submit" variant="destructive">
              Withdraw resource
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
