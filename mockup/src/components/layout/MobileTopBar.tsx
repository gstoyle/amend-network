import React from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { currentMember } from '../../data/portal';

export function MobileTopBar() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card lg:hidden">
      <div className="flex items-center justify-between gap-3 px-gutter py-2">
        <Link to="/" className="rounded-sm py-1">
          <span className="block text-sm font-semibold leading-tight tracking-tight text-foreground">
            Bridgewell Institute
          </span>
          <span className="block text-xs text-muted-foreground">Member portal</span>
        </Link>

        <div className="flex items-center gap-1">
          <Link
            to="/resources"
            aria-label="Search resources"
            className="flex h-tap w-tap items-center justify-center rounded-md text-muted-foreground transition-colors duration-fast ease-standard hover:bg-muted hover:text-foreground">
            
            <Search aria-hidden="true" className="h-5 w-5" />
          </Link>
          <Link
            to="/profile"
            aria-label={`Your profile, ${currentMember.name}`}
            className="flex h-tap w-tap items-center justify-center rounded-md">
            
            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border-strong bg-primary-subtle text-xs font-semibold text-primary-subtle-foreground">
              
              {currentMember.initials}
            </span>
          </Link>
        </div>
      </div>
    </header>);

}