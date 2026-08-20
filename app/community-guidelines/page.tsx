import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cardClassName } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function CommunityGuidelinesPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-gutter py-8 lg:px-gutter-lg lg:py-12">
      <p>
        <Link className={cn(buttonVariants({ variant: "ghost" }), "px-0")} href="/app/forum">
          Back to forum
        </Link>
      </p>
      <header>
        <p className="eyebrow text-muted-foreground">Member community</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground lg:text-3xl">
          Community guidelines
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          The forum is a professional space for Amend members. These guidelines explain how to
          participate safely and constructively.
        </p>
      </header>
      <section className={cn(cardClassName, "p-5 lg:p-6")} aria-labelledby="guidelines-heading">
        <h2 className="text-lg font-semibold text-foreground" id="guidelines-heading">
          How to participate
        </h2>
        <ul className="mt-4 flex list-disc flex-col gap-3 pl-5 text-foreground">
          <li>Participate only in the categories available to your program role.</li>
          <li>
            Use the supported markdown formatting. Do not add raw HTML, images, or identifying
            details.
          </li>
          <li>You may edit your own post for 15 minutes. Staff can moderate it after that.</li>
          <li>
            Flag content that is harmful, harassing, or off-mission so staff can review it.
          </li>
          <li>
            Rate limits apply: one new thread per minute, five posts per minute, and thirty posts
            per hour.
          </li>
          <li>
            Subscribe when you want reply emails. Every message includes an unsubscribe option.
          </li>
        </ul>
      </section>
      <aside className="rounded-lg border border-support bg-support-subtle p-4 text-sm text-support-subtle-foreground">
        For urgent safety concerns, contact Amend program staff directly. This page does not
        replace Amend&apos;s escalation policy.
      </aside>
    </main>
  );
}
