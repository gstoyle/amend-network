import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import { buttonVariants } from "@/components/ui/button";
import { cardClassName } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ForumDirectoryGate() {
  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        actions={
          <Link className={buttonVariants({ variant: "outline" })} href="/community-guidelines">
            Community guidelines
          </Link>
        }
        description="Programme rooms are named spaces. Join the directory so posts show your first name and last initial."
        eyebrow="Community"
        title="Forum"
      />
      <section aria-labelledby="forum-listing-heading">
        <SectionHeader
          eyebrow="Directory"
          id="forum-listing-heading"
          title="Join the directory to participate"
        />
        <div className={cn(cardClassName, "flex flex-col gap-3 p-5")}>
          <p className="text-sm text-muted-foreground">
            There are no anonymous posts. Members who appear in the directory can
            read and write in the rooms for their programme. Staff can still
            moderate without listing. Turning listing off later removes forum
            access; existing posts keep the name they were published with.
          </p>
          <p>
            <Link
              className={cn(buttonVariants({ variant: "default" }), "w-fit")}
              href="/app/profile/privacy"
            >
              Directory privacy
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
