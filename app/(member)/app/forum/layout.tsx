import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ForumDirectoryGate } from "@/components/forum-directory-gate";
import { AuthDeniedError, isPendingSession } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { loadForumAccess } from "@/lib/forum/access";

export default async function ForumLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const claims = session?.sessionId ? await loadSession(session.sessionId) : null;
  if (isPendingSession(claims)) {
    redirect("/app/pending");
  }
  let allowed = false;
  try {
    allowed = (await loadForumAccess(claims)).allowed;
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      redirect("/login");
    }
    throw error;
  }
  if (!allowed) {
    return <ForumDirectoryGate />;
  }
  return children;
}
