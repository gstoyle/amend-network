export type ReservedPanelProps = {
  /** Referenced by aria-labelledby so the region is named, not anonymous. */
  id: string;
  eyebrow: string;
  title: string;
  body: string;
};

/**
 * Stands in for a section whose underlying feature is not built yet. Carries no
 * link and no placeholder rows: a dead affordance reads as breakage, and a
 * skeleton implies content is loading.
 */
export function ReservedPanel({ body, eyebrow, id, title }: ReservedPanelProps) {
  return (
    <section
      aria-labelledby={id}
      className="rounded-lg border border-dashed border-border-strong bg-card p-4"
    >
      <p className="eyebrow text-muted-foreground">{eyebrow}</p>
      <h2
        className="mt-1 text-base font-semibold tracking-tight text-foreground"
        id={id}
      >
        {title}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </section>
  );
}
