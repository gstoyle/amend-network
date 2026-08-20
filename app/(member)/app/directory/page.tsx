import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DirectoryPrivacyPrompt } from "@/components/directory-privacy-prompt";
import { DirectorySearchForm } from "@/components/directory-search-form";
import { MemberInitials } from "@/components/member-initials";
import { PageHeader } from "@/components/page-header";
import { cardClassName } from "@/components/ui/card";
import { AuthDeniedError, isPendingSession, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { listDirectory } from "@/lib/directory/list";
import { loadDirectoryPrivacy } from "@/lib/directory/privacy";
import { cn } from "@/lib/utils";

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const session = await auth();
  const claims = session?.sessionId ? await loadSession(session.sessionId) : null;
  if (isPendingSession(claims)) {
    redirect("/app/pending");
  }

  let authorized;
  try {
    authorized = requireRole(claims);
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      redirect("/login");
    }
    throw error;
  }

  const query = firstParam((await searchParams).q);
  const [privacy, result] = await Promise.all([
    loadDirectoryPrivacy(authorized),
    listDirectory(authorized, { q: query }),
  ]);

  const members = result.ok ? result.members : [];
  const error = result.ok ? undefined : result.error;

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        description="People who chose to appear. Each profile only shows the fields that person turned on."
        eyebrow="Members"
        title="Directory"
      />
      {privacy.privacySetAt ? null : <DirectoryPrivacyPrompt />}
      <DirectorySearchForm error={error} query={query} />
      {members.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-strong bg-card px-6 py-12 text-center">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {query ? "No members match" : "No members to show"}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {query
              ? "Try a shorter name or leave the search blank."
              : "Nobody in your programme has chosen to appear yet."}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {members.map((member) => (
            <li key={member.id}>
              <article className={cn(cardClassName, "flex gap-4 p-4")}>
                <MemberInitials initials={member.initials} />
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold tracking-tight text-foreground">
                    <Link
                      className="rounded-sm underline decoration-transparent underline-offset-4 transition-colors duration-fast ease-standard hover:decoration-border-strong"
                      href={`/app/directory/${member.id}`}
                    >
                      {member.displayName}
                    </Link>
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">{member.networkLabel}</p>
                  {member.title ? (
                    <p className="mt-1 text-sm text-muted-foreground">{member.title}</p>
                  ) : null}
                  {member.docLabel ? (
                    <p className="mt-1 text-sm text-muted-foreground">{member.docLabel}</p>
                  ) : null}
                  {member.email ? (
                    <p className="mt-1 text-sm text-muted-foreground">{member.email}</p>
                  ) : null}
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
