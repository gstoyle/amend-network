import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { CohortList, type CohortFormState } from "@/components/cohort-list";
import { PageHeader } from "@/components/page-header";
import { clientIpFromHeaders } from "@/lib/auth/credentials";
import { AuthDeniedError } from "@/lib/auth/requireRole";
import { loadSession } from "@/lib/auth/session";
import {
  cohortErrorMessage,
  createCohort,
  listCohortsForAdmin,
  renameCohort,
  setCohortArchived,
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

async function createAction(_prev: CohortFormState, formData: FormData): Promise<CohortFormState> {
  "use server";
  try {
    await createCohort(await loadClaims(), {
      name: String(formData.get("name") ?? ""),
      programRole: String(formData.get("programRole") ?? ""),
      ...(await requestContext()),
    });
  } catch (error) {
    return asFormState(error);
  }
  revalidatePath("/admin/cohorts");
  return {};
}

async function renameAction(_prev: CohortFormState, formData: FormData): Promise<CohortFormState> {
  "use server";
  try {
    await renameCohort(await loadClaims(), {
      id: String(formData.get("id") ?? ""),
      name: String(formData.get("name") ?? ""),
      ...(await requestContext()),
    });
  } catch (error) {
    return asFormState(error);
  }
  revalidatePath("/admin/cohorts");
  return {};
}

async function archiveAction(_prev: CohortFormState, formData: FormData): Promise<CohortFormState> {
  "use server";
  try {
    await setCohortArchived(await loadClaims(), {
      id: String(formData.get("id") ?? ""),
      archived: formData.get("archived") === "true",
      ...(await requestContext()),
    });
  } catch (error) {
    return asFormState(error);
  }
  revalidatePath("/admin/cohorts");
  return {};
}

export default async function CohortsPage() {
  let cohorts;
  try {
    cohorts = await listCohortsForAdmin(await loadClaims());
  } catch (error) {
    if (error instanceof AuthDeniedError) {
      redirect("/login");
    }
    throw error;
  }

  const groups = (["pathways", "lead"] as const).map((programRole) => ({
    programRole,
    label: PROGRAM_LABELS[programRole],
    cohorts: cohorts.filter((cohort) => cohort.programRole === programRole),
  }));

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        description="Group members into trip cohorts. Archived cohorts keep their members and history but are hidden from registration and invitations."
        eyebrow="Member administration"
        title="Cohorts"
      />
      <CohortList
        archiveAction={archiveAction}
        createAction={createAction}
        groups={groups}
        renameAction={renameAction}
      />
    </div>
  );
}
