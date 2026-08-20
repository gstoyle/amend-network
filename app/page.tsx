import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthSplit, authLinkClassName } from "@/components/auth-split";
import { buttonVariants } from "@/components/ui/button";
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
    <AuthSplit
      description="A private space for approved Pathways to Change and LEAD members."
      footer={
        <p className="text-sm text-muted-foreground">
          Before participating, read the{" "}
          <Link className={authLinkClassName} href="/community-guidelines">
            community guidelines
          </Link>
          .
        </p>
      }
      panelAction={{ href: "/register", label: "Request access" }}
      title="Amend Member Network"
    >
      <nav aria-label="Join" className="flex flex-col gap-4">
        <Link className={buttonVariants()} href="/login">
          Sign in
        </Link>
        <Link
          className={buttonVariants({ variant: "outline" })}
          href="/register"
        >
          Request access
        </Link>
      </nav>
    </AuthSplit>
  );
}
