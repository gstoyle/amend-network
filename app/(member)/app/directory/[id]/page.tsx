import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { MemberInitials } from "@/components/member-initials";
import { clientIpFromHeaders } from "@/lib/auth/credentials";
import { AuthDeniedError, isPendingSession, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { getDirectoryProfile } from "@/lib/directory/profile";

export default async function DirectoryProfilePage({
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

  let authorized;
  try {
    authorized = requireRole(claims);
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      redirect("/login");
    }
    throw error;
  }

  const requestHeaders = await headers();
  let member;
  try {
    member = await getDirectoryProfile(authorized, id, {
      ip: clientIpFromHeaders(requestHeaders),
      userAgent: requestHeaders.get("user-agent") ?? "unknown",
    });
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      redirect("/login");
    }
    throw error;
  }
  if (!member) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-4 p-6 text-foreground">
      <p>
        <Link className="inline-flex min-h-touch items-center underline" href="/app/directory">
          Back to directory
        </Link>
      </p>
      <MemberInitials initials={member.initials} />
      <h1 className="text-2xl font-medium">{member.displayName}</h1>
      <p>{member.networkLabel}</p>
      {member.title ? <p>{member.title}</p> : null}
      {member.docLabel ? <p>{member.docLabel}</p> : null}
      {member.email ? <p>{member.email}</p> : null}
    </div>
  );
}
