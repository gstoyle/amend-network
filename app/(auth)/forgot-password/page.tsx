import Link from "next/link";
import { AuthSplit, authLinkClassName } from "@/components/auth-split";
import { ForgotPasswordForm } from "@/components/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthSplit
      description="Enter the email on your member account."
      footer={
        <p className="text-sm text-muted-foreground">
          Remembered it?{" "}
          <Link className={authLinkClassName} href="/login">
            Sign in
          </Link>
        </p>
      }
      panelAction={{ href: "/login", label: "Sign in" }}
      title="Forgot password"
    >
      <ForgotPasswordForm />
    </AuthSplit>
  );
}
