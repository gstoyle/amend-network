import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cardClassName } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function DirectoryPrivacyPrompt() {
  return (
    <aside aria-label="Directory privacy" className={cn(cardClassName, "flex flex-col gap-3 p-4")}>
      <p className="text-sm text-muted-foreground">
        You are not in the member directory until you choose. Forum rooms are
        named spaces: joining the directory is required to read and post, and
        posts show your first name and last initial. If you opt in, same-program
        members and staff who can view the directory will see your name and network.
        DOC affiliation, title, and email stay hidden unless you turn them on. Those
        hides apply to every viewer, including staff.
      </p>
      <p>
        <Link
          className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
          href="/app/profile/privacy"
        >
          Set directory privacy
        </Link>
      </p>
    </aside>
  );
}
