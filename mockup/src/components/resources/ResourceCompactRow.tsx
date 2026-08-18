import React from 'react';
import { Download } from 'lucide-react';
import { ResourceThumb } from './ResourceThumb';
import type { Resource } from '../../types/portal';

type ResourceCompactRowProps = {
  resource: Resource;
};

export function ResourceCompactRow({ resource }: ResourceCompactRowProps) {
  return (
    <li className="flex items-start gap-3 px-4 py-3.5">
      <ResourceThumb format={resource.format} size="sm" />

      <div className="min-w-0 flex-1">
        <p className="eyebrow text-muted-foreground">{resource.source}</p>
        <h3 className="mt-1 text-base font-medium tracking-tight text-foreground">
          <a
            href="#resource"
            className="rounded-sm underline decoration-transparent underline-offset-4 transition-colors duration-fast ease-standard hover:decoration-border-strong">
            
            {resource.title}
          </a>
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {resource.updated} · {resource.size}
        </p>
      </div>

      <a
        href="#download"
        aria-label={`Download ${resource.title}`}
        className="flex h-tap w-tap shrink-0 items-center justify-center rounded-md border border-border-strong text-foreground transition-colors duration-fast ease-standard hover:bg-muted">
        
        <Download aria-hidden="true" className="h-4 w-4" />
      </a>
    </li>);

}