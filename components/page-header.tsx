import type { ReactNode } from "react";

export type PageHeaderProps = {
  /** Small category line above the title. */
  eyebrow: string;
  title: string;
  description?: ReactNode;
};

export function PageHeader({ description, eyebrow, title }: PageHeaderProps) {
  return (
    <header>
      <p className="eyebrow text-muted-foreground">{eyebrow}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground lg:text-3xl">
        {title}
      </h1>
      {description ? (
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
      ) : null}
    </header>
  );
}
