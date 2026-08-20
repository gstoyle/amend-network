import Link from "next/link";
import { AuthSplit, authLinkClassName } from "@/components/auth-split";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <AuthSplit
      description="Member network"
      footer={
        <p className="text-sm text-muted-foreground">
          Need an account?{" "}
          <Link className={authLinkClassName} href="/register">
            Request access
          </Link>
        </p>
      }
      panelAction={{ href: "/register", label: "Request access" }}
      title="Sign in to Amend"
    >
      <LoginForm />
    </AuthSplit>
  );
}
