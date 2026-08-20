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
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-medium text-foreground">Forum emails</h1>
      <p className="text-foreground">
        {ok
          ? "You are unsubscribed from that thread."
          : "That unsubscribe link is not valid."}
      </p>
    </main>
  );
}
