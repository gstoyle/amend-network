import React from 'react';
import { NavLink } from 'react-router-dom';
import { navItems } from '../../data/navigation';

export function BottomTabBar() {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border-strong bg-card shadow-bar lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      
      <ul className="mx-auto flex max-w-content items-stretch">
        {navItems.map((item) =>
        <li key={item.to} className="flex-1">
            <NavLink
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
            `flex min-h-tap flex-col items-center justify-center gap-1 px-1 py-2 text-xs font-medium transition-colors duration-fast ease-standard ${
            isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`

            }>
            
              {({ isActive }) =>
            <>
                  <span
                aria-hidden="true"
                className={`h-0.5 w-6 rounded-full ${isActive ? 'bg-primary' : 'bg-transparent'}`} />
              
                  <item.icon
                aria-hidden="true"
                className="h-5 w-5"
                strokeWidth={isActive ? 2.25 : 1.75} />
              
                  {item.label}
                </>
            }
            </NavLink>
          </li>
        )}
      </ul>
    </nav>);

}