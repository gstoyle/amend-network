import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthDeniedError, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { listAdminResources } from "@/lib/resources/publish";

async function loadClaims() {
  const session = await auth();
  return session?.sessionId ? await loadSession(session.sessionId) : null;
}

export default async function AdminResourcesPage() {
  const claims = await loadClaims();
  let items;
  try {
    requireRole(claims, { admin: ["admin", "super_admin"], mfa: true });
    items = await listAdminResources(claims);
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      redirect("/login");
    }
    throw error;
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-2xl font-medium text-foreground">Resources</h1>
      <p>
        <Link className="text-foreground underline" href="/admin/resources/new">
          Publish a resource
        </Link>
      </p>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li className="text-foreground" key={item.id}>
            <p className="font-medium">{item.title}</p>
            <p className="text-sm">
              {item.sourceLabel} · {item.visibility.join(", ")}
              {item.deletedAt ? " · withdrawn" : ""}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
