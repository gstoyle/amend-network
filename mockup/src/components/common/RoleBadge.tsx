import React from 'react';
import type { MemberRole } from '../../types/portal';

type RoleBadgeProps = {
  role: MemberRole;
  className?: string;
};

const roleStyles: Record<MemberRole, string> = {
  Coordinator: 'bg-support-subtle text-support-subtle-foreground border-support',
  Trainer: 'bg-primary-subtle text-primary-subtle-foreground border-primary',
  Chaplain: 'bg-muted text-muted-foreground border-border-strong',
  'Program staff': 'bg-muted text-muted-foreground border-border-strong',
  Officer: 'bg-muted text-muted-foreground border-border-strong'
};

export function RoleBadge({ role, className = '' }: RoleBadgeProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-sm border px-1.5 py-0.5 text-xs font-medium ${roleStyles[role]} ${className}`}>
      
      {role}
    </span>);

}