import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { assertExportCsrf, exportAuditLog } from "@/lib/audit/export";
import { AuditFilterError } from "@/lib/audit/read";
import { clientIpFromHeaders } from "@/lib/auth/credentials";
import { AuthDeniedError } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";

function pickFilter(form: FormData | null, url: URL, name: string): string | undefined {
  const fromForm = form?.get(name);
  if (typeof fromForm === "string" && fromForm.length > 0) {
    return fromForm;
  }
  return url.searchParams.get(name) ?? undefined;
}

export async function POST(request: Request) {
  try {
    assertExportCsrf(request);
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      return new NextResponse(null, { status: 403 });
    }
    throw error;
  }

  const session = await auth();
  const claims = session?.sessionId ? await loadSession(session.sessionId) : null;
  const url = new URL(request.url);
  const contentType = request.headers.get("content-type") ?? "";
  const form = contentType.includes("form") ? await request.formData() : null;

  try {
    const result = await exportAuditLog(claims, {
      actor: pickFilter(form, url, "actor"),
      action: pickFilter(form, url, "action"),
      from: pickFilter(form, url, "from"),
      to: pickFilter(form, url, "to"),
      severity: pickFilter(form, url, "severity"),
      ip: clientIpFromHeaders(request.headers),
      userAgent: request.headers.get("user-agent") ?? "unknown",
    });
    return new NextResponse(result.csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="audit-log.csv"',
      },
    });
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      return new NextResponse(null, { status: 403 });
    }
    if (error instanceof AuditFilterError) {
      return new NextResponse(null, { status: 400 });
    }
    throw error;
  }
}
