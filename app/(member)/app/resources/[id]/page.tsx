import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { ResourceVideo } from "@/components/resource-video";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cardClassName } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { AuthDeniedError, isPendingSession, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { getResource } from "@/lib/resources/list";
import { cn, formatDayMonthYear } from "@/lib/utils";

export default async function MemberResourceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const claims = session?.sessionId ? await loadSession(session.sessionId) : null;
  if (isPendingSession(claims)) {
    redirect("/app/pending");
  }
  let resource;
  try {
    requireRole(claims);
    resource = await getResource(claims, id);
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
          href="/app/resources"
        >
          Back to resources
        </Link>
      </p>
      <PageHeader
        actions={
          resource.fileMimeType === "video/mp4" && resource.playbackHref ? null : (
            <a
              className={buttonVariants()}
              href={`/app/resources/${resource.id}/download`}
            >
              <Icon className="size-4" name="download" />
              Download
            </a>
          )
        }
        description={resource.previewText}
        eyebrow={resource.sourceLabel}
        title={resource.title}
      />

      <div className="grid items-start gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          {resource.fileMimeType === "video/mp4" && resource.playbackHref ? (
            <ResourceVideo src={resource.playbackHref} />
          ) : (
            <div className={cn(cardClassName, "overflow-hidden")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt=""
                className="aspect-video w-full object-cover"
                src={resource.thumbnailHref}
              />
            </div>
          )}
        </div>
        <aside className={cn(cardClassName, "flex flex-col gap-4 p-4 lg:col-span-4")}>
          <div>
            <p className="eyebrow text-muted-foreground">Resource details</p>
            <dl className="mt-3 divide-y divide-border text-sm">
              <div className="flex items-center justify-between gap-4 py-2 first:pt-0">
                <dt className="text-muted-foreground">Updated</dt>
                <dd className="font-medium text-foreground">
                  {formatDayMonthYear(resource.updatedAt)}
                </dd>
              </div>
              {resource.formatLabel ? (
                <div className="flex items-center justify-between gap-4 py-2">
                  <dt className="text-muted-foreground">Format</dt>
                  <dd className="font-medium text-foreground">{resource.formatLabel}</dd>
                </div>
              ) : null}
              {resource.sizeLabel ? (
                <div className="flex items-center justify-between gap-4 py-2">
                  <dt className="text-muted-foreground">Size</dt>
                  <dd className="font-medium text-foreground">{resource.sizeLabel}</dd>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-4 py-2 last:pb-0">
                <dt className="text-muted-foreground">Audience</dt>
                <dd>
                  <Badge
                    icon={resource.audience.restricted ? "lock" : "users"}
                    plain
                    tone={resource.audience.restricted ? "support" : "neutral"}
                  >
                    {resource.audience.label}
                  </Badge>
                </dd>
              </div>
            </dl>
          </div>
          {resource.fileMimeType === "video/mp4" ? (
            <a
              className={buttonVariants({ variant: "outline" })}
              href={`/app/resources/${resource.id}/download`}
            >
              <Icon className="size-4" name="download" />
              Download video
            </a>
          ) : null}
        </aside>
      </div>

      {resource.tags.length > 0 ? (
        <ul aria-label="Topics" className="flex flex-wrap gap-2">
          {resource.tags.map((tag) => (
            <li key={tag}>
              <Badge>{tag}</Badge>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
