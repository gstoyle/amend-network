import Link from "next/link";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import type { CohortFormState } from "@/components/cohort-list";
import { CohortMembers } from "@/components/cohort-members";
import { PageHeader } from "@/components/page-header";
import { clientIpFromHeaders } from "@/lib/auth/credentials";
import { AuthDeniedError } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import {
  addCohortMember,
  cohortErrorMessage,
  getCohortForAdmin,
  removeCohortMember,
} from "@/lib/cohorts/manage";
import { PROGRAM_LABELS } from "@/lib/db/program-labels";

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

function asFormState(error: unknown): CohortFormState {
  if (error instanceof AuthDeniedError) {
    redirect("/login");
  }
  const message = cohortErrorMessage(error);
  if (message) {
    return { error: message };
  }
  throw error;
}

async function addAction(_prev: CohortFormState, formData: FormData): Promise<CohortFormState> {
  "use server";
  const cohortId = String(formData.get("cohortId") ?? "");
  try {
    await addCohortMember(await loadClaims(), {
      cohortId,
      email: String(formData.get("email") ?? ""),
      ...(await requestContext()),
    });
  } catch (error) {
    return asFormState(error);
  }
  revalidatePath(`/admin/cohorts/${cohortId}`);
  return {};
}

async function removeAction(_prev: CohortFormState, formData: FormData): Promise<CohortFormState> {
  "use server";
  const cohortId = String(formData.get("cohortId") ?? "");
  try {
    await removeCohortMember(await loadClaims(), {
      cohortId,
      userId: String(formData.get("userId") ?? ""),
      ...(await requestContext()),
    });
  } catch (error) {
    return asFormState(error);
  }
  revalidatePath(`/admin/cohorts/${cohortId}`);
  return {};
}

export default async function CohortPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let detail;
  try {
    detail = await getCohortForAdmin(await loadClaims(), id);
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      redirect("/login");
    }
    throw error;
  }
  if (!detail) {
    notFound();
  }
  const { cohort, members } = detail;

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <Link className="text-sm text-muted-foreground underline-offset-4 hover:underline" href="/admin/cohorts">
        All cohorts
      </Link>
      <PageHeader
        description="Members of this cohort see content shared with it. A member's primary cohort is changed from their account, not here."
        eyebrow={PROGRAM_LABELS[cohort.programRole]}
        title={cohort.name}
      />
      <CohortMembers
        addAction={addAction}
        archived={cohort.archived}
        cohortId={cohort.id}
        members={members}
        removeAction={removeAction}
      />
    </div>
  );
}
