import React from 'react';
import { Link } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { RoleBadge } from '../components/common/RoleBadge';
import { currentMember } from '../data/portal';

const details = [
{ label: 'Member email', value: 'd.whitfield@bridgewell.org' },
{ label: 'Region', value: currentMember.region },
{ label: 'Credential', value: 'Core Practice trainer · renews 12 September 2026' },
{ label: 'Chapters', value: 'Springfield, Columbus' }];


export function Profile() {
  return (
    <div className="space-y-6 lg:space-y-8">
      <header className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-border-strong bg-primary-subtle text-base font-semibold text-primary-subtle-foreground">
          
          {currentMember.initials}
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground lg:text-3xl">
            {currentMember.name}
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <RoleBadge role={currentMember.role} />
            <span>{currentMember.memberSince}</span>
          </p>
        </div>
      </header>

      <dl className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
        {details.map((item) =>
        <div key={item.label} className="px-4 py-3.5">
            <dt className="eyebrow text-muted-foreground">{item.label}</dt>
            <dd className="mt-1 text-sm text-foreground">{item.value}</dd>
          </div>
        )}
      </dl>

      <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row">
        <Button variant="outline" className="min-h-tap border-border-strong">
          Edit details
        </Button>
        <Link
          to="/login"
          className="inline-flex min-h-tap items-center justify-center gap-2 rounded-md px-4 text-sm font-medium text-foreground transition-colors duration-fast ease-standard hover:bg-muted">
          
          <LogOut aria-hidden="true" className="h-4 w-4" />
          Sign out
        </Link>
      </div>
    </div>);

}