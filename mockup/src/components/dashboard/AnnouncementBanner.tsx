import React, { useState } from 'react';
import { Megaphone, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { announcement } from '../../data/portal';

export function AnnouncementBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return null;
  }

  return (
    <section
      aria-labelledby="announcement-title"
      className="relative rounded-lg border border-support bg-support-subtle p-4 lg:p-5">
      
      <div className="flex gap-3">
        <Megaphone
          aria-hidden="true"
          className="mt-0.5 hidden h-5 w-5 shrink-0 text-support sm:block" />
        
        <div className="min-w-0 flex-1">
          <p className="eyebrow text-support">Action required</p>
          <h2
            id="announcement-title"
            className="mt-1 pr-8 text-lg font-semibold tracking-tight text-foreground lg:text-xl">
            
            {announcement.title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-foreground">{announcement.body}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button className="min-h-tap w-full bg-support text-support-foreground hover:bg-support sm:w-auto">
              {announcement.actionLabel}
            </Button>
            <span className="text-xs text-muted-foreground">{announcement.postedAt}</span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss announcement"
        className="absolute right-2 top-2 flex h-tap w-tap items-center justify-center rounded-md text-muted-foreground transition-colors duration-fast ease-standard hover:bg-card hover:text-foreground">
        
        <X aria-hidden="true" className="h-4 w-4" />
      </button>
    </section>);

}