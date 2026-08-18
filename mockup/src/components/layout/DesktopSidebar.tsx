import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { LogOut, ShieldCheck } from 'lucide-react';
import { navItems } from '../../data/navigation';
import { currentMember } from '../../data/portal';
import { RoleBadge } from '../common/RoleBadge';

export function DesktopSidebar() {
  return (
    <div className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-border bg-sidebar lg:flex">
      <div className="border-b border-sidebar-border px-6 py-5">
        <Link
          to="/"
          className="block rounded-sm text-base font-semibold leading-tight tracking-tight text-sidebar-foreground">
          
          Bridgewell Institute
          <span className="mt-1 block text-xs font-normal text-muted-foreground">
            Member portal
          </span>
        </Link>
      </div>

      <div className="border-b border-sidebar-border px-6 py-4">
        <p className="text-sm font-semibold text-sidebar-foreground">{currentMember.name}</p>
        <p className="text-xs text-muted-foreground">{currentMember.region}</p>
        <RoleBadge role={currentMember.role} className="mt-2" />
      </div>

      <nav aria-label="Primary" className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {navItems.map((item) =>
          <li key={item.to}>
              <NavLink
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
              `flex min-h-tap items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-fast ease-standard ${
              isActive ?
              'bg-sidebar-accent text-sidebar-accent-foreground' :
              'text-muted-foreground hover:bg-muted hover:text-foreground'}`

              }>
              
                {({ isActive }) =>
              <>
                    <item.icon
                  aria-hidden="true"
                  className={`h-5 w-5 ${isActive ? 'text-primary' : ''}`}
                  strokeWidth={isActive ? 2.25 : 1.75} />
                
                    {item.label}
                  </>
              }
              </NavLink>
            </li>
          )}
        </ul>
      </nav>

      <div className="border-t border-sidebar-border px-3 py-4">
        <p className="flex items-start gap-2 px-3 pb-3 text-xs text-muted-foreground">
          <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          Private to members. Do not post identifying details.
        </p>
        <Link
          to="/login"
          className="flex min-h-tap items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors duration-fast ease-standard hover:bg-muted hover:text-foreground">
          
          <LogOut aria-hidden="true" className="h-4 w-4" />
          Sign out
        </Link>
      </div>
    </div>);

}