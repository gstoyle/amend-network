import React from 'react';
import { Lock, Users } from 'lucide-react';
import type { AccessLevel } from '../../types/portal';

type AccessBadgeProps = {
  access: AccessLevel;
  className?: string;
};

const labels: Record<AccessLevel, string> = {
  all: 'All members',
  trainers: 'Trainers only',
  leadership: 'Chapter leads only'
};

export function AccessBadge({ access, className = '' }: AccessBadgeProps) {
  const gated = access !== 'all';
  const Icon = gated ? Lock : Users;

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 text-xs font-medium ${
      gated ? 'text-support' : 'text-muted-foreground'} ${
      className}`}>
      
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {labels[access]}
    </span>);

}