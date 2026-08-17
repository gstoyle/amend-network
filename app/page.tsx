import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isPendingSession } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";

export default async function HomePage() {
  const session = await auth();
  if (session?.sessionId) {
    const claims = await loadSession(session.sessionId);
    if (isPendingSession(claims)) {
      redirect("/app/pending");
    }
    redirect(claims ? "/app" : "/login");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-medium text-foreground">Amend member network</h1>
      <nav aria-label="Join" className="flex flex-col gap-4">
        <Link
          className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          href="/login"
        >
          Sign in
        </Link>
        <Link
          className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground"
          href="/register"
        >
          Request access
        </Link>
      </nav>
    </main>
  );
}
