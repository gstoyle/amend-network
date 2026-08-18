import * as React from "react";
import { cn } from "@/lib/utils";

export const controlClassName =
  "flex min-h-touch w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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
