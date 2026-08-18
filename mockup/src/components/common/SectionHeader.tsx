import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

type SectionHeaderProps = {
  eyebrow: string;
  title: string;
  linkLabel?: string;
  linkTo?: string;
  id?: string;
};

export function SectionHeader({ eyebrow, title, linkLabel, linkTo, id }: SectionHeaderProps) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4 border-b border-border pb-2">
      <div>
        <p className="eyebrow text-muted-foreground">{eyebrow}</p>
        <h2 id={id} className="mt-1 text-xl font-semibold tracking-tight text-foreground">
          {title}
        </h2>
      </div>
      {linkLabel && linkTo ?
      <Link
        to={linkTo}
        className="group inline-flex min-h-tap items-center gap-1 rounded-sm px-2 text-sm font-medium text-primary underline decoration-border-strong underline-offset-4 transition-colors duration-fast ease-standard hover:decoration-primary">
        
          {linkLabel}
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link> :
      null}
    </div>);

}