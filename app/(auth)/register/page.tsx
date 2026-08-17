import { headers } from "next/headers";
import { RegisterForm, type RegisterFormState } from "@/components/register-form";
import { clientIpFromHeaders } from "@/lib/auth/credentials";
import { listActiveDocAffiliations } from "@/lib/registration/doc-affiliations";
import { listLaunchNetworks, registerSelf } from "@/lib/registration/register";

async function submitRegistration(
  _prev: RegisterFormState,
  formData: FormData,
): Promise<RegisterFormState> {
  "use server";
  const requestHeaders = await headers();
  const result = await registerSelf({
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    title: String(formData.get("title") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    docAffiliationId: String(formData.get("docAffiliation") ?? ""),
    networkId: String(formData.get("networkId") ?? ""),
    ip: clientIpFromHeaders(requestHeaders),
    userAgent: requestHeaders.get("user-agent") ?? "unknown",
  });
  if (!result.ok) {
    return { error: result.error };
  }
  return { message: result.message };
}

export default async function RegisterPage() {
  const [affiliations, networks] = await Promise.all([
    listActiveDocAffiliations(),
    listLaunchNetworks(),
  ]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-medium text-foreground">Request access</h1>
      <RegisterForm action={submitRegistration} affiliations={affiliations} networks={networks} />
    </main>
  );
}
