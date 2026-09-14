import type { ReactNode } from "react";
import { formSurfaceClassName } from "@/components/ui/card";

export function AuthSplit({
  children,
  description,
  footer,
  title,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex flex-1 flex-col items-center justify-center px-gutter py-10 lg:py-16">
        <div className="w-full max-w-md">
          <p className="mb-6 text-center text-sm font-semibold tracking-tight text-foreground">
            Amend
          </p>
          <div className={formSurfaceClassName}>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground lg:text-3xl">
              {title}
            </h1>
            {description ? (
              <p className="mt-2 text-sm text-muted-foreground">{description}</p>
            ) : null}
            <div className="mt-8">{children}</div>
            {footer ? <div className="mt-6">{footer}</div> : null}
          </div>
        </div>
      </main>
    </div>
  );
}

export const authLinkClassName =
  "font-medium text-primary underline decoration-border-strong underline-offset-4 hover:decoration-primary";
