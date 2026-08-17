import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { ResourceVideo } from "@/components/resource-video";
import { AuthDeniedError, isPendingSession, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { getResource } from "@/lib/resources/list";

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

  const lastUpdated = resource.updatedAt.toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-4 p-6 text-foreground">
      <p>
        <Link className="underline" href="/app/resources">
          Back to resources
        </Link>
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" className="max-h-48 w-auto" src={resource.thumbnailHref} />
      <h1 className="text-2xl font-medium">{resource.title}</h1>
      <p>{resource.previewText}</p>
      <p className="text-sm">{resource.sourceLabel}</p>
      {resource.tags.length > 0 ? (
        <ul className="flex flex-wrap gap-2 text-sm">
          {resource.tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      ) : null}
      <p>Last updated {lastUpdated}</p>
      {resource.fileMimeType === "video/mp4" && resource.playbackHref ? (
        <ResourceVideo src={resource.playbackHref} />
      ) : (
        <p>
          <a className="underline" href={`/app/resources/${resource.id}/download`}>
            Download
          </a>
        </p>
      )}
    </div>
  );
}
