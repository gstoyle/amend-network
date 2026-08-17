import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { InviteForm, type InviteFormState } from "@/components/invite-form";
import { clientIpFromHeaders } from "@/lib/auth/credentials";
import { AuthDeniedError, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import { listInvitations, reissueInvite, revokeInvite, sendCsvInvites, sendManualInvite } from "@/lib/registration/invite";
import { listLaunchNetworks } from "@/lib/registration/register";

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

function denyOrThrow(error: unknown): never {
  if (error instanceof AuthDeniedError) {
    redirect("/login");
  }
  throw error;
}

async function manualAction(
  _prev: InviteFormState,
  formData: FormData,
): Promise<InviteFormState> {
  "use server";
  try {
    const result = await sendManualInvite(await loadClaims(), {
      email: String(formData.get("email") ?? ""),
      firstName: String(formData.get("firstName") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
      networkId: String(formData.get("networkId") ?? ""),
      title: String(formData.get("title") ?? ""),
      ...(await requestContext()),
    });
    if (!result.ok) {
      return { error: result.error };
    }
  } catch (error) {
    denyOrThrow(error);
  }
  revalidatePath("/admin/users/invite");
  return { message: "Invitation sent." };
}

async function csvAction(
  _prev: InviteFormState,
  formData: FormData,
): Promise<InviteFormState> {
  "use server";
  const file = formData.get("csvFile");
  let csvText = String(formData.get("csvText") ?? "");
  if (file instanceof File && file.size > 0) {
    csvText = await file.text();
  }
  try {
    const result = await sendCsvInvites(await loadClaims(), {
      csvText,
      ...(await requestContext()),
    });
    if (!result.ok) {
      return {
        error: result.error === "oversize" ? "CSV has more than 500 data rows." : "CSV headers are not valid.",
      };
    }
    revalidatePath("/admin/users/invite");
    return {
      message: `Sent ${result.sent.length} invitation(s).`,
      invalid: result.invalid,
    };
  } catch (error) {
    denyOrThrow(error);
  }
}

async function revokeAction(formData: FormData): Promise<void> {
  "use server";
  try {
    await revokeInvite(await loadClaims(), {
      invitationId: String(formData.get("invitationId") ?? ""),
      ...(await requestContext()),
    });
  } catch (error) {
    denyOrThrow(error);
  }
  revalidatePath("/admin/users/invite");
}

async function reissueAction(formData: FormData): Promise<void> {
  "use server";
  try {
    const result = await reissueInvite(await loadClaims(), {
      invitationId: String(formData.get("invitationId") ?? ""),
      ...(await requestContext()),
    });
    if (!result.ok) {
      return;
    }
  } catch (error) {
    denyOrThrow(error);
  }
  revalidatePath("/admin/users/invite");
}

export default async function InvitePage() {
  const claims = await loadClaims();
  let networks;
  let items;
  try {
    requireRole(claims, { admin: ["admin", "super_admin"], mfa: true });
    [networks, items] = await Promise.all([listLaunchNetworks(), listInvitations(claims)]);
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      redirect("/login");
    }
    throw error;
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-2xl font-medium text-foreground">Invitations</h1>
      <InviteForm
        csvAction={csvAction}
        items={items}
        manualAction={manualAction}
        networks={networks}
        reissueAction={reissueAction}
        revokeAction={revokeAction}
      />
    </div>
  );
}
