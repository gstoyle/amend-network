import { auth } from "@/auth";
import { loadSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await auth();
  if (!session?.sessionId) {
    redirect("/login");
  }
  const claims = await loadSession(session.sessionId);
  redirect(claims ? "/app" : "/login");
}
