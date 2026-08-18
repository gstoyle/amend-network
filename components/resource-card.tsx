import Link from "next/link";
import { cardClassName } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type ResourceCardData = {
  id: string;
  title: string;
  previewText: string;
  sourceLabel: string;
  tags: string[];
  thumbnailHref: string;
};

export function ResourceCard({ resource }: { resource: ResourceCardData }) {
  return (
    <article className={cn(cardClassName, "flex flex-col gap-2 p-4")}>
      <Link className="flex flex-col gap-2" href={`/app/resources/${resource.id}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="" className="max-h-40 w-auto" src={resource.thumbnailHref} />
        <h2 className="text-lg font-medium">{resource.title}</h2>
        <p>{resource.previewText}</p>
        <p className="text-sm">{resource.sourceLabel}</p>
        {resource.tags.length > 0 ? (
          <ul className="flex flex-wrap gap-2 text-sm">
            {resource.tags.map((tag) => (
              <li key={tag}>{tag}</li>
            ))}
          </ul>
        ) : null}
      </Link>
    </article>
  );
}
