import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthSplit, authLinkClassName } from "@/components/auth-split";
import { buttonVariants } from "@/components/ui/button";
import { isPendingSession } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

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
    <AuthSplit
      description="Sign in for access to program announcements, resources, event information, and community forums."
      footer={
        <p className="text-sm text-muted-foreground">
          Before participating, read the{" "}
          <Link className={authLinkClassName} href="/community-guidelines">
            community guidelines
          </Link>
          .
        </p>
      }
      title="Amend Member Network"
    >
      <nav aria-label="Join" className="flex flex-col gap-4">
        <Link className={cn(buttonVariants(), "w-full")} href="/login">
          Sign in
        </Link>
        <Link
          className={cn(buttonVariants({ variant: "outline" }), "w-full")}
          href="/register"
        >
          Request access
        </Link>
      </nav>
    </AuthSplit>
  );
}
