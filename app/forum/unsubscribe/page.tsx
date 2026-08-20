import Link from "next/link";
import { AuthSplit, authLinkClassName } from "@/components/auth-split";
import { unsubscribeWithToken } from "@/lib/forum/subscribe";

export default async function ForumUnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string; thread?: string; token?: string }>;
}) {
  const query = await searchParams;
  const userId = query.user ?? "";
  const threadId = query.thread ?? "";
  const token = query.token ?? "";
  const ok =
    userId.length > 0 &&
    threadId.length > 0 &&
    token.length > 0 &&
    (await unsubscribeWithToken(userId, threadId, token));

  return (
    <AuthSplit
      description="Manage email updates for a forum discussion."
      footer={
        <p className="text-sm text-muted-foreground">
          Return to{" "}
          <Link className={authLinkClassName} href="/login">
            sign in
          </Link>
        </p>
      }
      panelAction={{ href: "/login", label: "Sign in" }}
      title="Forum emails"
    >
      <p
        className="rounded-md border border-border bg-muted p-4 text-sm text-foreground"
        role={ok ? "status" : "alert"}
      >
        {ok
          ? "You are unsubscribed from that thread."
          : "That unsubscribe link is not valid."}
      </p>
    </AuthSplit>
  );
}
