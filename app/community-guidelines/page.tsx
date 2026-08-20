import Link from "next/link";

export default function CommunityGuidelinesPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6">
      <p>
        <Link className="text-foreground underline" href="/login">
          Sign in
        </Link>
      </p>
      <h1 className="text-2xl font-medium text-foreground">Community guidelines</h1>
      <p className="text-foreground">
        The forum is a professional space for Amend members. These are the rules the product
        enforces. Programme staff own anything beyond them.
      </p>
      <ul className="flex list-disc flex-col gap-3 pl-5 text-foreground">
        <li>Stay in the category you can see. Visibility is role-gated; do not try to work around it.</li>
        <li>Write in allowlisted markdown only: bold, italics, and http(s) or /app/ links. No HTML and no image uploads.</li>
        <li>You may edit your own post for 15 minutes. After that, only staff can change it.</li>
        <li>Flag content that is harmful, harassing, or off-mission. Staff can hide or delete posts and lock or pin threads.</li>
        <li>Rate limits apply: one new thread per minute, five posts per minute, thirty posts per hour.</li>
        <li>Subscribe to a thread if you want email when someone else replies. Unsubscribe from that email at any time.</li>
      </ul>
      <p className="text-muted-foreground">
        Escalation for harm sits with Amend programme staff. This page does not replace that
        policy.
      </p>
    </main>
  );
}
