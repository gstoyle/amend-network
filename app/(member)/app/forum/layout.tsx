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
  try {
    const access = await loadForumAccess(claims);
    if (!access.allowed) {
      return <ForumDirectoryGate />;
    }
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      redirect("/login");
    }
    throw error;
  }
  return children;
}
