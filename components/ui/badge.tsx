import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "primary" | "support";

const BORDERED_TONES: Record<BadgeTone, string> = {
  neutral: "border-border-strong bg-muted text-muted-foreground",
  primary: "border-primary bg-primary-subtle text-primary-subtle-foreground",
  support: "border-support bg-support-subtle text-support-subtle-foreground",
};

const PLAIN_TONES: Record<BadgeTone, string> = {
  neutral: "text-muted-foreground",
  primary: "text-primary",
  support: "text-support",
};

export type BadgeProps = {
  children: React.ReactNode;
  className?: string;
  icon?: IconName;
  /** Plain drops the border and fill, for markers that sit inside card meta rows. */
  plain?: boolean;
  tone?: BadgeTone;
};

/**
 * A static label. Deliberately has no interactive semantics and no 44px floor,
 * so it must never be used as a control.
 */
export function Badge({
  children,
  className,
  icon,
  plain = false,
  tone = "neutral",
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 text-xs font-medium",
        plain
          ? PLAIN_TONES[tone]
          : cn("rounded-sm border px-1.5 py-0.5", BORDERED_TONES[tone]),
        className,
      )}
    >
      {icon ? <Icon className="size-3.5" name={icon} /> : null}
      {children}
    </span>
  );
}
