import Link from "next/link";
import type { ReactNode } from "react";

export function AuthSplit({
  children,
  description,
  footer,
  panelAction,
  title,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  panelAction: { href: string; label: string };
}) {
  return (
    <div className="grid min-h-screen bg-card lg:grid-cols-2">
      <main className="flex flex-col overflow-y-auto">
        <p className="px-gutter pt-8 text-sm font-semibold tracking-tight text-foreground lg:px-gutter-lg">
          Amend
        </p>
        <div className="flex flex-1 flex-col justify-center px-gutter py-10 lg:px-gutter-lg lg:py-16">
          <div className="mx-auto w-full max-w-md">
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
      <aside
        aria-label="About this network"
        className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:flex lg:flex-col"
      >
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 size-full text-primary-subtle"
          focusable="false"
        >
          <defs>
            <pattern
              height="20"
              id="auth-brand-dots"
              patternUnits="userSpaceOnUse"
              width="20"
            >
              <circle cx="1.5" cy="1.5" r="1.5" fill="currentColor" />
            </pattern>
            <clipPath clipPathUnits="objectBoundingBox" id="auth-brand-globe">
              <circle cx="0.78" cy="0.52" r="0.42" />
            </clipPath>
          </defs>
          <rect
            clipPath="url(#auth-brand-globe)"
            fill="url(#auth-brand-dots)"
            height="100%"
            width="100%"
          />
        </svg>
        <div className="relative z-10 flex justify-end px-gutter-lg pt-8">
          <Link
            className="inline-flex min-h-touch min-w-touch items-center rounded-md border border-primary-foreground px-4 text-sm font-medium text-primary-foreground"
            href={panelAction.href}
          >
            {panelAction.label}
          </Link>
        </div>
        <div className="relative z-10 flex flex-1 flex-col justify-center px-gutter-lg py-16">
          <p className="text-sm font-medium">Amend Member Network</p>
          <p className="mt-3 max-w-lg text-3xl font-semibold tracking-tight lg:text-4xl">
            For Pathways to Change and LEAD members.
          </p>
          <p className="mt-4 max-w-md text-sm text-primary-foreground">
            Program resources, events, announcements, and the member directory —
            visible only after Amend confirms your account.
          </p>
        </div>
      </aside>
    </div>
  );
}

export const authLinkClassName =
  "font-medium text-primary underline decoration-border-strong underline-offset-4 hover:decoration-primary";
