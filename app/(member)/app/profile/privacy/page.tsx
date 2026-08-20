import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  DirectoryPrivacyForm,
  type DirectoryPrivacyFormState,
} from "@/components/directory-privacy-form";
import { PageHeader } from "@/components/page-header";
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
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        description="Choose whether you appear, and which optional fields other members can see. Hides apply to every viewer, including staff."
        eyebrow="Account"
        title="Directory privacy"
      />
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
