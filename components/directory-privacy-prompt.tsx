import Link from "next/link";

export function DirectoryPrivacyPrompt() {
  return (
    <aside aria-label="Directory privacy" className="flex flex-col gap-3 p-6">
      <p className="text-foreground">
        You are not in the member directory until you choose. If you opt in, same-program
        members and staff who can view the directory will see your name and network.
        DOC affiliation, title, and email stay hidden unless you turn them on. Those
        hides apply to every viewer, including staff.
      </p>
      <p>
        <Link
          className="inline-flex min-h-touch items-center text-foreground underline"
          href="/app/profile/privacy"
        >
          Set directory privacy
        </Link>
      </p>
    </aside>
  );
}
