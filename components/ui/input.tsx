import * as React from "react";
import { cn } from "@/lib/utils";

export const controlClassName =
  "flex min-h-touch w-full rounded-md border border-border-strong bg-field px-3 py-2 text-sm text-foreground shadow-xs ring-offset-background transition-colors duration-fast ease-standard placeholder:text-muted-foreground hover:border-primary focus-visible:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 read-only:bg-muted read-only:text-muted-foreground";

export const checkboxClassName =
  "size-4 shrink-0 accent-primary";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input({ className, type = "text", ...props }, ref) {
    return (
      <input
        type={type}
        className={cn(controlClassName, className)}
        ref={ref}
        {...props}
      />
    );
  },
);
