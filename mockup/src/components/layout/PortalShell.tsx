import React from 'react';
import { BottomTabBar } from './BottomTabBar';
import { DesktopSidebar } from './DesktopSidebar';
import { MobileTopBar } from './MobileTopBar';

type PortalShellProps = {
  children: React.ReactNode;
};

export function PortalShell({ children }: PortalShellProps) {
  return (
    <div className="min-h-screen w-full bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-30 focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-md">
        
        Skip to main content
      </a>

      <DesktopSidebar />
      <MobileTopBar />

      <div className="lg:pl-64">
        <main
          id="main-content"
          className="mx-auto w-full max-w-content px-gutter pb-24 pt-6 lg:px-gutter-lg lg:pb-16 lg:pt-10">
          
          {children}
        </main>
      </div>

      <BottomTabBar />
    </div>);

}