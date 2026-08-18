export function MemberInitials({ initials }: { initials: string }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground"
    >
      {initials}
    </span>
  );
}
