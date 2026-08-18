import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DirectoryPrivacyPrompt } from "@/components/directory-privacy-prompt";
import { DirectorySearchForm } from "@/components/directory-search-form";
import { MemberInitials } from "@/components/member-initials";
import { AuthDeniedError, isPendingSession, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { listDirectory } from "@/lib/directory/list";
import { loadDirectoryPrivacy } from "@/lib/directory/privacy";

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
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-2xl font-medium text-foreground">Directory</h1>
      {privacy.privacySetAt ? null : <DirectoryPrivacyPrompt />}
      <DirectorySearchForm error={error} query={query} />
      {members.length === 0 ? (
        <p className="text-foreground">No members match.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {members.map((member) => (
            <li className="flex flex-col gap-1 text-foreground" key={member.id}>
              <p className="flex items-center gap-3 font-medium">
                <MemberInitials initials={member.initials} />
                <Link
                  className="inline-flex min-h-touch items-center underline"
                  href={`/app/directory/${member.id}`}
                >
                  {member.displayName}
                </Link>
              </p>
              <p>{member.networkLabel}</p>
              {member.title ? <p>{member.title}</p> : null}
              {member.docLabel ? <p>{member.docLabel}</p> : null}
              {member.email ? <p>{member.email}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
