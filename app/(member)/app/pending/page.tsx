import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { cardClassName } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { AuthDeniedError, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export default async function PendingPage() {
  const session = await auth();
  const claims = session?.sessionId ? await loadSession(session.sessionId) : null;
  try {
    requireRole(claims, { statuses: ["pending"] });
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      redirect("/login");
    }
    throw error;
  }

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        description="Amend staff are reviewing your registration before member access is enabled."
        eyebrow="Account status"
        title="Request under review"
      />
      <section className={cn(cardClassName, "flex items-start gap-3 p-4 lg:p-6")}>
        <span className="flex h-tap w-tap shrink-0 items-center justify-center rounded-md bg-primary-subtle text-primary-subtle-foreground">
          <Icon className="size-5" name="shield" />
        </span>
        <div>
          <h2 className="font-semibold text-foreground">No action is needed right now</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Once your request is approved, you can sign in and use the member area.
          </p>
        </div>
      </section>
    </div>
  );
}
