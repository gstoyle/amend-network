import React from 'react';
import { FileText, Film, LayoutTemplate, Presentation, Wrench } from 'lucide-react';
import type { ResourceFormat } from '../../types/portal';

type ResourceThumbProps = {
  format: ResourceFormat;
  size?: 'sm' | 'lg';
};

const formatMeta: Record<ResourceFormat, {icon: typeof FileText;tone: string;}> = {
  PDF: { icon: FileText, tone: 'bg-primary-subtle text-primary-subtle-foreground' },
  Toolkit: { icon: Wrench, tone: 'bg-support-subtle text-support-subtle-foreground' },
  Video: { icon: Film, tone: 'bg-info-subtle text-info' },
  Slides: { icon: Presentation, tone: 'bg-warning-subtle text-warning' },
  Template: { icon: LayoutTemplate, tone: 'bg-muted text-muted-foreground' }
};

export function ResourceThumb({ format, size = 'lg' }: ResourceThumbProps) {
  const { icon: Icon, tone } = formatMeta[format];

  return (
    <div
      aria-hidden="true"
      className={`flex shrink-0 flex-col items-center justify-center gap-1 rounded-md border border-border ${tone} ${
      size === 'lg' ? 'h-20 w-20' : 'h-14 w-14'}`
      }>
      
      <Icon className={size === 'lg' ? 'h-6 w-6' : 'h-5 w-5'} strokeWidth={1.75} />
      <span className="eyebrow leading-none">{format}</span>
    </div>);

}