import React from 'react';
import { Download, Lock } from 'lucide-react';
import { Button } from '../ui/Button';
import { AccessBadge } from '../common/AccessBadge';
import { ResourceThumb } from './ResourceThumb';
import type { Resource } from '../../types/portal';

type ResourceCardProps = {
  resource: Resource;
  locked?: boolean;
};

export function ResourceCard({ resource, locked = false }: ResourceCardProps) {
  return (
    <article className="flex flex-col rounded-lg border border-border bg-card p-4 shadow-xs lg:p-5">
      <div className="flex gap-4">
        <ResourceThumb format={resource.format} />

        <div className="min-w-0 flex-1">
          <p className="eyebrow text-muted-foreground">{resource.source}</p>
          <h3 className="mt-1 text-base font-semibold tracking-tight text-foreground lg:text-lg">
            <a
              href="#resource"
              className="rounded-sm underline decoration-transparent underline-offset-4 transition-colors duration-fast ease-standard hover:decoration-border-strong">
              
              {resource.title}
            </a>
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">{resource.preview}</p>
        </div>
      </div>

      <ul className="mt-4 flex flex-wrap gap-2" aria-label="Tags">
        {resource.tags.map((tag) =>
        <li
          key={tag}
          className="rounded-sm border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          
            {tag}
          </li>
        )}
      </ul>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div className="text-xs text-muted-foreground">
          <p>{resource.updated}</p>
          <p className="mt-0.5 flex items-center gap-2">
            <span>
              {resource.format} · {resource.size}
            </span>
            <AccessBadge access={resource.access} />
          </p>
        </div>

        {locked ?
        <Button variant="outline" className="min-h-tap w-full border-border-strong sm:w-auto">
            <Lock aria-hidden="true" className="h-4 w-4" />
            Request access
          </Button> :

        <Button className="min-h-tap w-full sm:w-auto">
            <Download aria-hidden="true" className="h-4 w-4" />
            Download
            <span className="sr-only"> {resource.title}</span>
          </Button>
        }
      </div>
    </article>);

}