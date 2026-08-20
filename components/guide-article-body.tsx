import Link from "next/link";
import type { GuideBlock } from "@/lib/guide/types";

const LIST_CLASS = "flex list-disc flex-col gap-2 pl-5 text-foreground";
const ORDERED_CLASS = "flex list-decimal flex-col gap-2 pl-5 text-foreground";
const LINK_CLASS =
  "inline-flex min-h-touch items-center text-sm font-medium text-foreground underline decoration-border-strong underline-offset-4";

function GuideBlockView({ block }: { block: GuideBlock }) {
  switch (block.type) {
    case "p":
      return <p className="text-foreground">{block.text}</p>;
    case "ul":
      return (
        <ul className={LIST_CLASS}>
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol className={ORDERED_CLASS}>
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      );
    case "h2":
      return (
        <h2 className="scroll-mt-6 text-xl font-semibold tracking-tight text-foreground" id={block.id}>
          {block.text}
        </h2>
      );
    case "callout":
      return (
        <aside
          aria-label={block.title}
          className={
            block.tone === "warning"
              ? "rounded-lg border border-support bg-support-subtle p-4"
              : "rounded-lg border border-border bg-card p-4"
          }
        >
          <p className="text-sm font-medium text-foreground">{block.title}</p>
          <p className="mt-2 text-sm text-muted-foreground">{block.text}</p>
        </aside>
      );
    case "steps":
      return (
        <ol className="flex flex-col gap-3">
          {block.items.map((item, index) => (
            <li
              className="rounded-lg border border-border bg-card p-4"
              key={item.title}
            >
              <p className="text-sm font-medium text-foreground">
                {index + 1}. {item.title}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{item.text}</p>
            </li>
          ))}
        </ol>
      );
    case "links":
      return (
        <ul className="flex flex-col gap-2">
          {block.items.map((item) => (
            <li key={item.href}>
              <Link className={LINK_CLASS} href={item.href}>
                {item.label}
              </Link>
              {item.description ? (
                <p className="text-sm text-muted-foreground">{item.description}</p>
              ) : null}
            </li>
          ))}
        </ul>
      );
    default: {
      const exhaustive: never = block;
      return exhaustive;
    }
  }
}

export function GuideArticleBody({ blocks }: { blocks: GuideBlock[] }) {
  return (
    <div className="flex flex-col gap-4">
      {blocks.map((block, index) => (
        <GuideBlockView
          block={block}
          key={block.type === "h2" ? block.id : `${block.type}-${index}`}
        />
      ))}
    </div>
  );
}
