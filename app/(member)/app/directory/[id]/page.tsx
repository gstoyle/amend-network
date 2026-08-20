import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { MemberInitials } from "@/components/member-initials";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { cardClassName } from "@/components/ui/card";
import { clientIpFromHeaders } from "@/lib/auth/credentials";
import { AuthDeniedError, isPendingSession, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { getDirectoryProfile } from "@/lib/directory/profile";
import { cn } from "@/lib/utils";

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

  const details = [
    { label: "Network", value: member.networkLabel },
    { label: "Title", value: member.title },
    { label: "DOC affiliation", value: member.docLabel },
    { label: "Email", value: member.email },
  ].filter((row): row is { label: string; value: string } => Boolean(row.value));

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <p>
        <Link
          className={cn(buttonVariants({ variant: "ghost" }), "px-0")}
          href="/app/directory"
        >
          Back to directory
        </Link>
      </p>
      <div className="flex items-start gap-4">
        <MemberInitials initials={member.initials} size="lg" />
        <PageHeader
          description={member.networkLabel}
          eyebrow="Directory"
          title={member.displayName}
        />
      </div>
      {details.length > 0 ? (
        <dl className={cn(cardClassName, "divide-y divide-border overflow-hidden")}>
          {details.map((row) => (
            <div className="px-4 py-3.5" key={row.label}>
              <dt className="eyebrow text-muted-foreground">{row.label}</dt>
              <dd className="mt-1 text-sm text-foreground">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
