import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cardClassName } from "@/components/ui/card";
import { Icon, type IconName } from "@/components/ui/icon";
import type { AudienceMarker } from "@/lib/db/visibility";
import type { ResourceFormat } from "@/lib/resources/list";
import { cn, formatDayMonthYear } from "@/lib/utils";

export type ResourceCardData = {
  id: string;
  title: string;
  previewText: string;
  sourceLabel: string;
  tags: string[];
  updatedAt: Date;
  thumbnailHref: string;
  formatLabel: ResourceFormat | null;
  sizeLabel: string | null;
  audience: AudienceMarker;
};

const FORMAT_GLYPH: Record<ResourceFormat, IconName> = {
  PDF: "file",
  Video: "video",
  Slides: "slides",
  Template: "template",
  Toolkit: "toolkit",
};

const FORMAT_TONE: Record<ResourceFormat, string> = {
  PDF: "bg-primary-subtle text-primary-subtle-foreground",
  Video: "bg-info-subtle text-info",
  Slides: "bg-warning-subtle text-warning",
  Template: "bg-muted text-muted-foreground",
  Toolkit: "bg-support-subtle text-support-subtle-foreground",
};

/**
 * The thumbnail is served by the authenticated grant handler (004 FR-012), so it
 * can 404 for a withdrawn row; the format tile stays visible underneath as the
 * fallback. Decorative because the title sits next to it and the format repeats
 * as text, so the tile is never the only carrier of either meaning.
 */
export function ResourceThumb({
  format,
  size = "lg",
  thumbnailHref,
}: {
  format: ResourceFormat | null;
  size?: "sm" | "lg";
  thumbnailHref: string;
}) {
  const large = size === "lg";
  return (
    <div className={cn("flex shrink-0 flex-col items-center gap-1", large ? "w-20" : "w-14")}>
      <div
        aria-hidden="true"
        className={cn(
          "relative flex w-full items-center justify-center overflow-hidden rounded-md border border-border",
          large ? "h-20" : "h-14",
          format ? FORMAT_TONE[format] : "bg-muted text-muted-foreground",
        )}
      >
        <Icon
          className={large ? "size-6" : "size-5"}
          name={format ? FORMAT_GLYPH[format] : "file"}
        />
        <img alt="" className="absolute inset-0 size-full object-cover" src={thumbnailHref} />
      </div>
      {format ? (
        <span aria-hidden="true" className="eyebrow leading-none text-muted-foreground">
          {format}
        </span>
      ) : null}
    </div>
  );
}

function AudienceBadge({ audience }: { audience: AudienceMarker }) {
  return (
    <Badge
      icon={audience.restricted ? "lock" : "users"}
      plain
      tone={audience.restricted ? "support" : "neutral"}
    >
      {audience.label}
    </Badge>
  );
}

export function ResourceCard({ resource }: { resource: ResourceCardData }) {
  const formatAndSize = [resource.formatLabel, resource.sizeLabel].filter(Boolean).join(" · ");

  return (
    <article className={cn(cardClassName, "flex h-full flex-col p-4 shadow-xs lg:p-5")}>
      <div className="flex gap-4">
        <ResourceThumb format={resource.formatLabel} thumbnailHref={resource.thumbnailHref} />
        <div className="min-w-0 flex-1">
          <p className="eyebrow text-muted-foreground">{resource.sourceLabel}</p>
          <h3 className="mt-1 text-base font-semibold tracking-tight text-foreground lg:text-lg">
            <Link
              className="rounded-sm underline decoration-transparent underline-offset-4 transition-colors duration-fast ease-standard hover:decoration-border-strong"
              href={`/app/resources/${resource.id}`}
            >
              {resource.title}
            </Link>
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">{resource.previewText}</p>
        </div>
      </div>

      {resource.tags.length > 0 ? (
        <ul aria-label="Tags" className="mt-4 flex flex-wrap gap-2">
          {resource.tags.map((tag) => (
            <li key={tag}>
              <Badge>{tag}</Badge>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div className="text-xs text-muted-foreground">
          <p>Updated {formatDayMonthYear(resource.updatedAt)}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-2">
            {formatAndSize ? <span>{formatAndSize}</span> : null}
            <AudienceBadge audience={resource.audience} />
          </p>
        </div>

        <Link
          className={cn(buttonVariants({ variant: "default" }), "w-full gap-2 sm:w-auto")}
          href={`/app/resources/${resource.id}`}
        >
          <Icon className="size-4" name="download" />
          Download
          <span className="sr-only"> {resource.title}</span>
        </Link>
      </div>
    </article>
  );
}

/** Compact variant for dashboard previews. Shares the tile and audience marker. */
export function ResourceCompactRow({ resource }: { resource: ResourceCardData }) {
  return (
    <li className="flex items-start gap-3 px-4 py-3.5">
      <ResourceThumb
        format={resource.formatLabel}
        size="sm"
        thumbnailHref={resource.thumbnailHref}
      />
      <div className="min-w-0 flex-1">
        <p className="eyebrow text-muted-foreground">{resource.sourceLabel}</p>
        <h3 className="mt-1 text-base font-medium tracking-tight text-foreground">
          <Link
            className="rounded-sm underline decoration-transparent underline-offset-4 transition-colors duration-fast ease-standard hover:decoration-border-strong"
            href={`/app/resources/${resource.id}`}
          >
            {resource.title}
          </Link>
        </h3>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Updated {formatDayMonthYear(resource.updatedAt)}</span>
          <AudienceBadge audience={resource.audience} />
        </p>
      </div>
      <Link
        aria-label={`Download ${resource.title}`}
        className="flex size-tap shrink-0 items-center justify-center rounded-md border border-border-strong text-foreground transition-colors duration-fast ease-standard hover:bg-muted"
        href={`/app/resources/${resource.id}`}
      >
        <Icon className="size-4" name="download" />
      </Link>
    </li>
  );
}
