import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { createFolderAction } from "@/app/(admin)/admin/resources/actions";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cardClassName, formFieldClassName, formSurfaceClassName } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { AuthDeniedError, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { audienceLabel } from "@/lib/db/visibility";
import { listAdminFolders } from "@/lib/resources/folders";
import { listAdminResources } from "@/lib/resources/publish";
import { cn } from "@/lib/utils";

async function loadClaims() {
  const session = await auth();
  return session?.sessionId ? await loadSession(session.sessionId) : null;
}

export default async function AdminResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;
  const claims = await loadClaims();
  let items;
  let folders;
  try {
    requireRole(claims, { admin: ["admin", "super_admin"], mfa: true });
    [items, folders] = await Promise.all([
      listAdminResources(claims),
      listAdminFolders(claims),
    ]);
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      redirect("/login");
    }
    throw error;
  }
  const parents = folders.filter((folder) => !folder.parentId);

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        actions={
          <Link className={buttonVariants()} href="/admin/resources/new">
            Publish a resource
          </Link>
        }
        description="Manage endorsed Amend materials, member shares, and folders."
        eyebrow="Administration"
        title="Resources"
      />
      {query.error ? (
        <p className="text-sm text-destructive" role="alert">
          {query.error}
        </p>
      ) : null}
      <section className={formSurfaceClassName} aria-labelledby="folder-heading">
        <h2 className="text-lg font-semibold text-foreground" id="folder-heading">
          Folders
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Nest one level, for example Policies and then a location.
        </p>
        <form action={createFolderAction} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className={formFieldClassName}>
            <Label htmlFor="folder-name">Name</Label>
            <Input id="folder-name" maxLength={80} name="name" required />
          </div>
          <div className={formFieldClassName}>
            <Label htmlFor="folder-parent">Inside</Label>
            <Select defaultValue="" id="folder-parent" name="parentId">
              <option value="">Top level</option>
              {parents.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-end">
            <Button type="submit">Add folder</Button>
          </div>
        </form>
        {folders.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {folders.map((folder) => (
              <li key={folder.id}>
                <Badge plain>
                  {folder.parentName ? `${folder.parentName} / ${folder.name}` : folder.name}
                </Badge>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      {items.length === 0 ? (
        <section className={cn(cardClassName, "border-dashed p-6 text-center")}>
          <h2 className="font-semibold text-foreground">No resources yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Publish the first resource to make it available to members.
          </p>
          <Link className={cn(buttonVariants(), "mt-4")} href="/admin/resources/new">
          Publish a resource
        </Link>
        </section>
      ) : (
        <ul className="grid gap-3">
          {items.map((item) => {
            const audience = audienceLabel(item.visibility);
            return (
              <li key={item.id}>
                <Link
                  className={cn(
                    cardClassName,
                    "flex min-h-touch flex-col items-start justify-between gap-3 p-4 transition-colors duration-fast ease-standard hover:border-border-strong hover:bg-muted sm:flex-row sm:items-center",
                  )}
                  href={`/admin/resources/${item.id}`}
                >
                  <span className="min-w-0">
                    <span className="block font-semibold text-foreground">{item.title}</span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      {item.sourceLabel}
                      {item.folderName ? ` · ${item.folderName}` : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                    {item.deletedAt ? <Badge tone="support">Withdrawn</Badge> : null}
                    <Badge
                      icon={audience.restricted ? "lock" : "users"}
                      plain
                      tone={audience.restricted ? "support" : "neutral"}
                    >
                      {audience.label}
                    </Badge>
                  </span>
              </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
