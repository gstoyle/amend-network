import Link from "next/link";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-medium text-foreground">Sign in</h1>
      <LoginForm />
      <p className="text-sm text-muted-foreground">
        <Link className="underline" href="/forgot-password">
          Forgot password
        </Link>
      </p>
    </main>
  );
}
