import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { PendingQueue } from "@/components/pending-queue";
import { clientIpFromHeaders } from "@/lib/auth/credentials";
import { AuthDeniedError, requireRole } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import {
  approveRegistration,
  denyRegistration,
  listPendingRegistrations,
} from "@/lib/registration/approve";
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

async function approveAction(formData: FormData): Promise<void> {
  "use server";
  const networkId = String(formData.get("networkId") ?? "");
  try {
    await approveRegistration(await loadClaims(), {
      userId: String(formData.get("userId") ?? ""),
      ...(networkId.length > 0 ? { networkId } : {}),
      ...(await requestContext()),
    });
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      redirect("/login");
    }
    throw error;
  }
  revalidatePath("/admin/users/pending");
}

async function denyAction(formData: FormData): Promise<void> {
  "use server";
  try {
    await denyRegistration(await loadClaims(), {
      userId: String(formData.get("userId") ?? ""),
      reason: String(formData.get("reason") ?? ""),
      ...(await requestContext()),
    });
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      redirect("/login");
    }
    throw error;
  }
  revalidatePath("/admin/users/pending");
}

export default async function PendingRegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ networkId?: string }>;
}) {
  const claims = await loadClaims();
  const params = await searchParams;
  const networkId = params.networkId && params.networkId.length > 0 ? params.networkId : undefined;
  let items;
  try {
    requireRole(claims, { admin: ["admin", "super_admin"], mfa: true });
    items = await listPendingRegistrations(claims, { networkId });
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      redirect("/login");
    }
    throw error;
  }
  const networks = await listLaunchNetworks();

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        description="Review access requests, confirm the correct network, and keep denial reasons private."
        eyebrow="Member administration"
        title="Pending registrations"
      />
      <PendingQueue
        approveAction={approveAction}
        denyAction={denyAction}
        items={items}
        networks={networks}
        selectedNetworkId={networkId}
      />
    </div>
  );
}
