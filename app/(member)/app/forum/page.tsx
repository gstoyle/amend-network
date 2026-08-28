import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cardClassName } from "@/components/ui/card";
import { AuthDeniedError, isPendingSession, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { listForumCategories } from "@/lib/forum/list";
import { cn } from "@/lib/utils";

export default async function ForumIndexPage() {
  const session = await auth();
  const claims = session?.sessionId ? await loadSession(session.sessionId) : null;
  if (isPendingSession(claims)) {
    redirect("/app/pending");
  }
  let categories;
  try {
    requireRole(claims);
    categories = await listForumCategories(claims);
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      redirect("/login");
    }
    throw error;
  }

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        actions={
          <Link className={buttonVariants({ variant: "outline" })} href="/community-guidelines">
            Community guidelines
          </Link>
        }
        description="Discussion rooms for your programme. Posts use the same allowlisted markdown as announcements. Community guidelines apply."
        eyebrow="Community"
        title="Forum"
      />
      <section aria-labelledby="forum-rooms-heading">
        <SectionHeader eyebrow="Community" id="forum-rooms-heading" title="Discussion rooms" />
        {categories.length === 0 ? (
          <div className={cn(cardClassName, "border-dashed p-6 text-center")}>
            <p className="text-sm text-muted-foreground">
              No categories are available to you yet.
            </p>
          </div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  className={cn(
                    cardClassName,
                    "flex min-h-touch h-full flex-col gap-3 p-5 transition-shadow duration-fast ease-standard hover:shadow-md",
                  )}
                  href={`/app/forum/${category.slug}`}
                >
                  <span className="flex flex-wrap items-start justify-between gap-2">
                    <span className="font-semibold text-foreground">{category.name}</span>
                    <Badge plain tone={category.audience.restricted ? "support" : "neutral"}>
                      {category.audience.label}
                    </Badge>
                  </span>
                  <span className="text-sm text-muted-foreground">{category.description}</span>
                  <span className="mt-auto border-t border-border pt-3 text-sm font-medium text-primary">
                    {category.threadCount} {category.threadCount === 1 ? "thread" : "threads"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
