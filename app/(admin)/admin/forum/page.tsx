import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { createCategoryAction } from "@/app/(admin)/admin/forum/actions";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cardClassName } from "@/components/ui/card";
import { controlClassName, Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthDeniedError, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { audienceLabel } from "@/lib/db/visibility";
import { listAdminCategories } from "@/lib/forum/categories";
import {
  FORUM_CATEGORY_ADMIN_ROLES,
  FORUM_STAFF_ROLES,
} from "@/lib/forum/staff";
import { cn } from "@/lib/utils";

const VISIBILITY_OPTIONS = [
  { value: "all_authenticated", label: "Everyone signed in" },
  { value: "pathways", label: "Pathways only" },
  { value: "lead", label: "LEAD only" },
] as const;

export default async function AdminForumPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;
  const session = await auth();
  const claims = session?.sessionId ? await loadSession(session.sessionId) : null;
  let canManageCategories = false;
  let categories: Awaited<ReturnType<typeof listAdminCategories>> = [];
  try {
    const authorized = requireRole(claims, { admin: [...FORUM_STAFF_ROLES], mfa: true });
    canManageCategories = FORUM_CATEGORY_ADMIN_ROLES.includes(authorized.adminRole);
    if (canManageCategories) {
      categories = await listAdminCategories(authorized);
    }
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
          <Link
            className={buttonVariants({ variant: "outline" })}
            href="/admin/forum/flags"
          >
          Open flags
        </Link>
        }
        description="Manage discussion categories and review member-reported content."
        eyebrow="Administration"
        title="Forum"
      />
      {query.error ? (
        <p className="text-sm text-destructive" role="alert">
          {query.error}
        </p>
      ) : null}
      {canManageCategories ? (
        <>
          <form
            action={createCategoryAction}
            className={cn(cardClassName, "flex max-w-2xl flex-col gap-4 p-4 lg:p-6")}
          >
            <div>
              <h2 className="text-lg font-semibold text-foreground">Create a category</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose a short name, URL slug, description, and member audience.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" maxLength={80} name="name" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" maxLength={80} name="slug" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                className={controlClassName}
                id="description"
                maxLength={500}
                name="description"
                required
                rows={3}
              />
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium text-foreground">Visibility</legend>
              {VISIBILITY_OPTIONS.map((option) => (
                <label className="flex min-h-touch items-center gap-2 text-foreground" key={option.value}>
                  <input
                    defaultChecked={option.value === "all_authenticated"}
                    name="visibility"
                    type="checkbox"
                    value={option.value}
                  />
                  {option.label}
                </label>
              ))}
            </fieldset>
            <Button type="submit">Create category</Button>
          </form>
          <section aria-labelledby="forum-categories-heading">
            <h2
              className="mb-3 text-lg font-semibold text-foreground"
              id="forum-categories-heading"
            >
              Categories
            </h2>
            {categories.length === 0 ? (
              <div className={cn(cardClassName, "border-dashed p-6 text-center")}>
                <p className="text-sm text-muted-foreground">No categories yet.</p>
              </div>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {categories.map((category) => {
                  const audience = audienceLabel(category.visibility);
                  return (
                    <li className={cn(cardClassName, "p-4")} key={category.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-foreground">{category.name}</h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            /{category.slug}
                          </p>
                        </div>
                        <Badge
                          icon={audience.restricted ? "lock" : "users"}
                          plain
                          tone={audience.restricted ? "support" : "neutral"}
                        >
                          {audience.label}
                        </Badge>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      ) : (
        <section className={cn(cardClassName, "p-4")}>
          <h2 className="font-semibold text-foreground">Category management unavailable</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Creating categories is limited to administrators. You can still review open flags.
          </p>
        </section>
      )}
    </div>
  );
}
