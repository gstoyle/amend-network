import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  deleteFlaggedAction,
  hideFlaggedAction,
  keepFlagAction,
} from "@/app/(admin)/admin/forum/actions";
import { Button } from "@/components/ui/button";
import { AuthDeniedError, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { listOpenFlags } from "@/lib/forum/moderate";
import { FORUM_STAFF_ROLES } from "@/lib/forum/staff";
import { formatDayMonthYear } from "@/lib/utils";

export default async function AdminForumFlagsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;
  const session = await auth();
  const claims = session?.sessionId ? await loadSession(session.sessionId) : null;
  let flags;
  try {
    requireRole(claims, { admin: [...FORUM_STAFF_ROLES], mfa: true });
    flags = await listOpenFlags(claims);
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      redirect("/login");
    }
    throw error;
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <p>
        <Link className="text-foreground underline" href="/admin/forum">
          Forum categories
        </Link>
      </p>
      <h1 className="text-2xl font-medium text-foreground">Forum flags</h1>
      {query.error ? <p className="text-destructive">{query.error}</p> : null}
      {flags.length === 0 ? (
        <p className="text-foreground">No open flags.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {flags.map((flag) => (
            <li className="flex flex-col gap-2 border border-border p-4 text-foreground" key={flag.id}>
              <p>
                <Link className="underline" href={`/app/forum/t/${flag.threadId}`}>
                  Open thread
                </Link>
                {" · "}
                {formatDayMonthYear(flag.createdAt)}
              </p>
              <p>{flag.reason}</p>
              <p className="text-sm">{flag.excerpt}</p>
              <div className="flex flex-wrap gap-2">
                <form action={keepFlagAction}>
                  <input name="postId" type="hidden" value={flag.postId} />
                  <Button type="submit" variant="outline">
                    Keep
                  </Button>
                </form>
                <form action={hideFlaggedAction}>
                  <input name="postId" type="hidden" value={flag.postId} />
                  <Button type="submit" variant="outline">
                    Hide
                  </Button>
                </form>
                <form action={deleteFlaggedAction}>
                  <input name="postId" type="hidden" value={flag.postId} />
                  <Button type="submit" variant="outline">
                    Delete
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
