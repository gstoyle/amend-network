import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { createThreadAction } from "@/app/(member)/app/forum/actions";
import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  formFieldClassName,
  formGridClassName,
  formSurfaceClassName,
} from "@/components/ui/card";
import { controlClassName, Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthDeniedError, isPendingSession, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { getForumCategory } from "@/lib/forum/list";
import { cn } from "@/lib/utils";

export default async function NewForumThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const session = await auth();
  const claims = session?.sessionId ? await loadSession(session.sessionId) : null;
  if (isPendingSession(claims)) {
    redirect("/app/pending");
  }
  let category;
  try {
    requireRole(claims);
    category = await getForumCategory(claims, slug);
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      redirect("/login");
    }
    throw error;
  }
  if (!category) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <p>
        <Link
          className={cn(buttonVariants({ variant: "ghost" }), "px-0")}
          href={`/app/forum/${category.slug}`}
        >
          Back to {category.name}
        </Link>
      </p>
      <PageHeader
        description={
          <>
            Allowlisted markdown only. Read the{" "}
            <Link className="underline" href="/community-guidelines">
              community guidelines
            </Link>{" "}
            before posting.
          </>
        }
        eyebrow={category.name}
        title="Start a thread"
      />
      {query.error ? <p className="text-sm text-destructive">{query.error}</p> : null}
      <form
        action={createThreadAction}
        className={cn(formSurfaceClassName, formGridClassName)}
      >
        <input name="slug" type="hidden" value={category.slug} />
        <div className={cn(formFieldClassName, "lg:col-span-2")}>
          <Label htmlFor="title">Title</Label>
          <Input id="title" maxLength={120} name="title" required />
        </div>
        <div className={cn(formFieldClassName, "lg:col-span-2")}>
          <Label htmlFor="body">First post</Label>
          <textarea
            className={controlClassName}
            id="body"
            maxLength={8000}
            name="body"
            required
            rows={8}
          />
        </div>
        <Button className="justify-self-start lg:col-span-2" type="submit">
          Post thread
        </Button>
      </form>
    </div>
  );
}
