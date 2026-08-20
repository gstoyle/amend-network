import Link from "next/link";
import { Icon } from "@/components/ui/icon";

export type SectionHeaderProps = {
  /** Small category line above the title. */
  eyebrow: string;
  /** Referenced by the owning section's aria-labelledby. */
  id: string;
  title: string;
  linkHref?: string;
  linkLabel?: string;
};

export function SectionHeader({
  eyebrow,
  id,
  linkHref,
  linkLabel,
  title,
}: SectionHeaderProps) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4 border-b border-border pb-2">
      <div>
        <p className="eyebrow text-muted-foreground">{eyebrow}</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground" id={id}>
          {title}
        </h2>
      </div>
      {linkHref && linkLabel ? (
        <Link
          className="inline-flex min-h-touch items-center gap-1 rounded-sm px-2 text-sm font-medium text-primary underline decoration-border-strong underline-offset-4 transition-colors duration-fast ease-standard hover:decoration-primary"
          href={linkHref}
        >
          {linkLabel}
          <Icon className="size-4" name="arrow-right" />
        </Link>
      ) : null}
    </div>
  );
}
