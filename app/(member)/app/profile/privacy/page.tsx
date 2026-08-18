import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  DirectoryPrivacyForm,
  type DirectoryPrivacyFormState,
} from "@/components/directory-privacy-form";
import { clientIpFromHeaders } from "@/lib/auth/credentials";
import { AuthDeniedError, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { loadDirectoryPrivacy, saveDirectoryPrivacy } from "@/lib/directory/privacy";

async function savePrivacyAction(
  _prev: DirectoryPrivacyFormState,
  formData: FormData,
): Promise<DirectoryPrivacyFormState> {
  "use server";
  const session = await auth();
  const claims = session?.sessionId ? await loadSession(session.sessionId) : null;
  const requestHeaders = await headers();
  try {
    const result = await saveDirectoryPrivacy(
      claims,
      {
        listing: formData.get("listing") === "true",
        showTitle: formData.get("showTitle") === "true",
        showDocAffiliation: formData.get("showDocAffiliation") === "true",
        showEmail: formData.get("showEmail") === "true",
      },
      {
        ip: clientIpFromHeaders(requestHeaders),
        userAgent: requestHeaders.get("user-agent") ?? "unknown",
      },
    );
    if (!result.ok) {
      return { error: result.error };
    }
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      redirect("/login");
    }
    throw error;
  }
  redirect("/app/profile/privacy");
}

export default async function DirectoryPrivacyPage() {
  const session = await auth();
  const claims = session?.sessionId ? await loadSession(session.sessionId) : null;
  let authorized;
  try {
    authorized = requireRole(claims);
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      redirect("/login");
    }
    throw error;
  }

  const privacy = await loadDirectoryPrivacy(authorized);

  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-2xl font-medium text-foreground">Directory privacy</h1>
      <DirectoryPrivacyForm
        action={savePrivacyAction}
        canAppear={privacy.canAppear}
        docLabel={privacy.docLabel}
        email={privacy.email}
        listing={privacy.listing}
        showDocAffiliation={privacy.showDocAffiliation}
        showEmail={privacy.showEmail}
        showTitle={privacy.showTitle}
        title={privacy.title}
      />
    </div>
  );
}
