import { headers } from "next/headers";
import { auth } from "@/auth";
import {
  InviteCompleteForm,
  type InviteCompleteFormState,
} from "@/components/invite-complete-form";
import { clientIpFromHeaders } from "@/lib/auth/credentials";
import { listActiveDocAffiliations } from "@/lib/registration/doc-affiliations";
import {
  INVITE_SIGNED_IN_COPY,
  INVITE_UNUSABLE_COPY,
  INVITE_USED_COPY,
  completeInvite,
  lookupInvite,
} from "@/lib/registration/invite";

async function submitInvite(
  _prev: InviteCompleteFormState,
  formData: FormData,
): Promise<InviteCompleteFormState> {
  "use server";
  const session = await auth();
  const requestHeaders = await headers();
  const result = await completeInvite({
    token: String(formData.get("token") ?? ""),
    password: String(formData.get("password") ?? ""),
    title: String(formData.get("title") ?? ""),
    docAffiliationId: String(formData.get("docAffiliation") ?? ""),
    ip: clientIpFromHeaders(requestHeaders),
    userAgent: requestHeaders.get("user-agent") ?? "unknown",
    signedIn: Boolean(session?.sessionId),
  });
  if (!result.ok) {
    return { error: result.error };
  }
  return { message: "Your membership is active. You can sign in." };
}

export default async function InviteCompletePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await auth();
  const signedIn = Boolean(session?.sessionId);
  const preview = signedIn ? { state: "signed_in" as const } : await lookupInvite(token);
  const affiliations = preview.state === "pending" ? await listActiveDocAffiliations() : [];

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-medium text-foreground">Complete invitation</h1>
      {preview.state === "signed_in" ? (
        <p role="alert">{INVITE_SIGNED_IN_COPY}</p>
      ) : null}
      {preview.state === "used" ? <p role="alert">{INVITE_USED_COPY}</p> : null}
      {preview.state === "unusable" ? <p role="alert">{INVITE_UNUSABLE_COPY}</p> : null}
      {preview.state === "pending" ? (
        <InviteCompleteForm
          action={submitInvite}
          affiliations={affiliations}
          docAffiliationId={preview.docAffiliationId}
          email={preview.email}
          firstName={preview.firstName}
          lastName={preview.lastName}
          networkName={preview.networkName}
          title={preview.title}
          token={token}
        />
      ) : null}
    </main>
  );
}
