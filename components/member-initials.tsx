import { cn } from "@/lib/utils";

export function MemberInitials({
  initials,
  size = "sm",
}: {
  initials: string;
  size?: "sm" | "lg";
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex min-h-touch min-w-touch shrink-0 items-center justify-center rounded-full border border-border-strong bg-primary-subtle font-semibold text-primary-subtle-foreground",
        size === "lg" ? "size-14 text-base" : "text-xs",
      )}
    >
      {initials}
    </span>
  );
}
