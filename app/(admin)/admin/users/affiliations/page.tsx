import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  DocAffiliationForm,
  type AffiliationFormState,
} from "@/components/doc-affiliation-form";
import { PageHeader } from "@/components/page-header";
import { clientIpFromHeaders } from "@/lib/auth/credentials";
import { AuthDeniedError, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import {
  addDocAffiliation,
  deactivateDocAffiliation,
  editDocAffiliation,
  listAllDocAffiliations,
} from "@/lib/registration/doc-affiliations";

async function loadClaims() {
  const session = await auth();
  return session?.sessionId ? await loadSession(session.sessionId) : null;
}

async function requestContext() {
  const requestHeaders = await headers();
  return {
    ip: clientIpFromHeaders(requestHeaders),
    userAgent: requestHeaders.get("user-agent") ?? "unknown",
  };
}

function asErrorMessage(error: unknown): AffiliationFormState {
  if (error instanceof AuthDeniedError) {
    redirect("/login");
  }
  if (error instanceof Error && error.message === "duplicate_label") {
    return { error: "That label already exists." };
  }
  throw error;
}

async function addAction(
  _prev: AffiliationFormState,
  formData: FormData,
): Promise<AffiliationFormState> {
  "use server";
  try {
    await addDocAffiliation(await loadClaims(), {
      label: String(formData.get("label") ?? ""),
      ...(await requestContext()),
    });
  } catch (error) {
    return asErrorMessage(error);
  }
  revalidatePath("/admin/users/affiliations");
  return {};
}

async function editAction(formData: FormData): Promise<void> {
  "use server";
  try {
    await editDocAffiliation(await loadClaims(), {
      id: String(formData.get("id") ?? ""),
      label: String(formData.get("label") ?? ""),
      ...(await requestContext()),
    });
  } catch (error) {
    asErrorMessage(error);
    return;
  }
  revalidatePath("/admin/users/affiliations");
}

async function deactivateAction(formData: FormData): Promise<void> {
  "use server";
  try {
    await deactivateDocAffiliation(await loadClaims(), {
      id: String(formData.get("id") ?? ""),
      ...(await requestContext()),
    });
  } catch (error) {
    asErrorMessage(error);
    return;
  }
  revalidatePath("/admin/users/affiliations");
}

export default async function AffiliationsPage() {
  const claims = await loadClaims();
  let items;
  try {
    requireRole(claims, { admin: ["admin", "super_admin"], mfa: true });
    items = await listAllDocAffiliations(claims);
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      redirect("/login");
    }
    throw error;
  }

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        description="Maintain the affiliation choices members can select during registration."
        eyebrow="Member administration"
        title="DOC affiliations"
      />
      <DocAffiliationForm
        addAction={addAction}
        deactivateAction={deactivateAction}
        editAction={editAction}
        items={items}
      />
    </div>
  );
}
