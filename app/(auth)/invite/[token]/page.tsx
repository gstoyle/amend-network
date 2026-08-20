import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { AuthSplit, authLinkClassName } from "@/components/auth-split";
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

  const feedback =
    preview.state === "signed_in"
      ? INVITE_SIGNED_IN_COPY
      : preview.state === "used"
        ? INVITE_USED_COPY
        : preview.state === "unusable"
          ? INVITE_UNUSABLE_COPY
          : null;

  return (
    <AuthSplit
      description="Confirm your member details and choose a password to activate your account."
      footer={
        <p className="text-sm text-muted-foreground">
          Already registered?{" "}
          <Link className={authLinkClassName} href="/login">
            Sign in
          </Link>
        </p>
      }
      panelAction={{ href: "/login", label: "Sign in" }}
      title="Complete invitation"
    >
      {feedback ? (
        <p className="rounded-md border border-border bg-muted p-4 text-sm text-foreground" role="alert">
          {feedback}
        </p>
      ) : null}
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
    </AuthSplit>
  );
}
