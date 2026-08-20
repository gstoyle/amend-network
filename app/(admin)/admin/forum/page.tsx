import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { createCategoryAction } from "@/app/(admin)/admin/forum/actions";
import { Button } from "@/components/ui/button";
import { controlClassName, Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthDeniedError, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { listAdminCategories } from "@/lib/forum/categories";
import {
  FORUM_CATEGORY_ADMIN_ROLES,
  FORUM_STAFF_ROLES,
} from "@/lib/forum/staff";

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
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-medium text-foreground">Forum</h1>
      <p>
        <Link className="text-foreground underline" href="/admin/forum/flags">
          Open flags
        </Link>
      </p>
      {query.error ? <p className="text-destructive">{query.error}</p> : null}
      {canManageCategories ? (
        <>
          <form action={createCategoryAction} className="flex max-w-xl flex-col gap-4">
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
          <ul className="flex flex-col gap-2">
            {categories.map((category) => (
              <li className="text-foreground" key={category.id}>
                {category.name} ({category.slug}) · {category.visibility.join(", ")}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-foreground">Category create is limited to admin and super admin.</p>
      )}
    </div>
  );
}
