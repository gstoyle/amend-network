import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { AuditLogExport } from "@/components/audit-log-export";
import { AuditLogFilters } from "@/components/audit-log-filters";
import { AuditFilterError, listAuditLog, type AuditLogPage } from "@/lib/audit/read";
import { clientIpFromHeaders } from "@/lib/auth/credentials";
import { AuthDeniedError } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";

function firstQueryValue(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw == null || raw === "") {
    return undefined;
  }
  return raw;
}

function nextPageHref(values: {
  actor?: string;
  action?: string;
  from?: string;
  to?: string;
  severity?: string;
  cursor: string;
}): string {
  const params = new URLSearchParams();
  if (values.actor) params.set("actor", values.actor);
  if (values.action) params.set("action", values.action);
  if (values.from) params.set("from", values.from);
  if (values.to) params.set("to", values.to);
  if (values.severity) params.set("severity", values.severity);
  params.set("cursor", values.cursor);
  return `/admin/audit-log?${params.toString()}`;
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{
    actor?: string | string[];
    action?: string | string[];
    from?: string | string[];
    to?: string | string[];
    severity?: string | string[];
    cursor?: string | string[];
  }>;
}) {
  const session = await auth();
  const claims = session?.sessionId ? await loadSession(session.sessionId) : null;
  const requestHeaders = await headers();
  const params = await searchParams;
  const actor = firstQueryValue(params.actor);
  const action = firstQueryValue(params.action);
  const from = firstQueryValue(params.from);
  const to = firstQueryValue(params.to);
  const severity = firstQueryValue(params.severity);
  const cursor = firstQueryValue(params.cursor);

  let page: AuditLogPage = { rows: [], nextCursor: null };
  let filterInvalid = false;
  try {
    page = await listAuditLog(claims, {
      actor,
      action,
      from,
      to,
      severity,
      cursor,
      ip: clientIpFromHeaders(requestHeaders),
      userAgent: requestHeaders.get("user-agent") ?? "unknown",
    });
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      redirect("/login");
    }
    if (error instanceof AuditFilterError) {
      filterInvalid = true;
    } else {
      throw error;
    }
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-2xl font-medium text-foreground">Audit log</h1>
      <AuditLogFilters values={{ actor, action, from, to, severity }} />
      <AuditLogExport
        canExport={claims?.adminRole === "super_admin"}
        values={{ actor, action, from, to, severity }}
      />
      {filterInvalid ? (
        <p className="text-sm text-muted-foreground">Check the form and try again.</p>
      ) : null}
      <div
        aria-label="Audit log table"
        className="overflow-x-auto"
        role="region"
        tabIndex={0}
      >
        <table className="w-full text-sm text-foreground">
          <caption className="sr-only">Audit log</caption>
          <thead>
            <tr>
              <th className="whitespace-nowrap px-2 py-2 text-left font-medium" scope="col">
                When
              </th>
              <th className="whitespace-nowrap px-2 py-2 text-left font-medium" scope="col">
                Actor
              </th>
              <th className="whitespace-nowrap px-2 py-2 text-left font-medium" scope="col">
                Role
              </th>
              <th className="whitespace-nowrap px-2 py-2 text-left font-medium" scope="col">
                Action
              </th>
              <th className="whitespace-nowrap px-2 py-2 text-left font-medium" scope="col">
                Entity
              </th>
              <th className="whitespace-nowrap px-2 py-2 text-left font-medium" scope="col">
                Target
              </th>
              <th className="whitespace-nowrap px-2 py-2 text-left font-medium" scope="col">
                IP
              </th>
              <th className="whitespace-nowrap px-2 py-2 text-left font-medium" scope="col">
                User agent
              </th>
              <th className="whitespace-nowrap px-2 py-2 text-left font-medium" scope="col">
                Severity
              </th>
            </tr>
          </thead>
          <tbody>
            {page.rows.map((row) => (
              <tr key={row.id}>
                <td className="whitespace-nowrap px-2 py-2">{row.createdAt}</td>
                <td className="whitespace-nowrap px-2 py-2">{row.actorUserId ?? ""}</td>
                <td className="whitespace-nowrap px-2 py-2">{row.actorRole}</td>
                <td className="whitespace-nowrap px-2 py-2">{row.action}</td>
                <td className="whitespace-nowrap px-2 py-2">
                  {[row.entityType, row.entityId].filter(Boolean).join(" ")}
                </td>
                <td className="whitespace-nowrap px-2 py-2">{row.targetUserId ?? ""}</td>
                <td className="whitespace-nowrap px-2 py-2">{row.ip}</td>
                <td className="whitespace-nowrap px-2 py-2">{row.userAgent}</td>
                <td className="whitespace-nowrap px-2 py-2">{row.severity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {page.nextCursor ? (
        <p>
          <Link
            className="inline-flex min-h-touch items-center text-foreground underline"
            href={nextPageHref({
              actor,
              action,
              from,
              to,
              severity,
              cursor: page.nextCursor,
            })}
          >
            Next
          </Link>
        </p>
      ) : null}
    </div>
  );
}
