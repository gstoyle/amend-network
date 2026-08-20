import Link from "next/link";
import { AuthSplit, authLinkClassName } from "@/components/auth-split";
import { ResetPasswordForm } from "@/components/reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params.token ?? "";

  return (
    <AuthSplit
      description="Choose a new password with at least 12 characters."
      footer={
        <p className="text-sm text-muted-foreground">
          Return to{" "}
          <Link className={authLinkClassName} href="/login">
            sign in
          </Link>
        </p>
      }
      panelAction={{ href: "/login", label: "Sign in" }}
      title="Reset password"
    >
      <ResetPasswordForm token={token} />
    </AuthSplit>
  );
}
