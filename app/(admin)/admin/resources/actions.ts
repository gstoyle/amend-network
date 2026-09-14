"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { clientIpFromHeaders } from "@/lib/auth/credentials";
import { AuthDeniedError } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { createResourceFolder } from "@/lib/resources/folders";

async function claims() {
  const session = await auth();
  return session?.sessionId ? await loadSession(session.sessionId) : null;
}

export async function createFolderAction(formData: FormData): Promise<void> {
  const requestHeaders = await headers();
  try {
    const result = await createResourceFolder(await claims(), {
      name: String(formData.get("name") ?? ""),
      parentId: String(formData.get("parentId") ?? ""),
      ip: clientIpFromHeaders(requestHeaders),
      userAgent: requestHeaders.get("user-agent") ?? "unknown",
    });
    if (!result.ok) {
      redirect(`/admin/resources?error=${encodeURIComponent(result.error)}`);
    }
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      redirect("/login");
    }
    throw error;
  }
  revalidatePath("/admin/resources");
  revalidatePath("/app/resources");
  redirect("/admin/resources");
}
