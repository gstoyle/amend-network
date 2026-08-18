import React from 'react';
import { Lock, MessageSquare, Pin } from 'lucide-react';
import { RoleBadge } from '../common/RoleBadge';
import type { ForumThread } from '../../types/portal';

type ThreadRowProps = {
  thread: ForumThread;
};

export function ThreadRow({ thread }: ThreadRowProps) {
  return (
    <li className={thread.pinned ? 'bg-muted' : ''}>
      <a
        href="#thread"
        className="flex gap-3 px-4 py-4 transition-colors duration-fast ease-standard hover:bg-muted lg:px-5">
        
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {thread.pinned ?
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-support">
                <Pin aria-hidden="true" className="h-3.5 w-3.5" />
                Pinned
              </span> :
            null}
            {thread.locked ?
            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <Lock aria-hidden="true" className="h-3.5 w-3.5" />
                Closed
              </span> :
            null}
            {thread.unread ?
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-primary" />
                New replies
              </span> :
            null}
          </div>

          <h3
            className={`mt-1 text-base tracking-tight text-foreground lg:text-lg ${
            thread.unread ? 'font-semibold' : 'font-medium'}`
            }>
            
            {thread.title}
          </h3>

          <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2-token">{thread.excerpt}</p>

          <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{thread.author}</span>
            <RoleBadge role={thread.role} />
            <span aria-hidden="true">·</span>
            <span>Last activity {thread.lastActivity}</span>
          </p>
        </div>

        <div className="flex w-14 shrink-0 flex-col items-center justify-start gap-0.5 border-l border-border pl-3 text-center">
          <MessageSquare aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
          <span className="text-base font-semibold leading-none text-foreground">
            {thread.replies}
          </span>
          <span className="text-xs text-muted-foreground">
            {thread.replies === 1 ? 'reply' : 'replies'}
          </span>
        </div>
      </a>
    </li>);

}