import type { ReactNode, SelectHTMLAttributes } from "react";
import { Icon } from "@/components/ui/icon";
import { controlClassName } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function Select({
  children,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {

  return (
    <div className="relative">
      <select
        className={cn(controlClassName, "appearance-none pr-10", className)}
        {...props}
      >
        {children}
      </select>
      <Icon
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        name="chevron-down"
      />
    </div>
  );
}
