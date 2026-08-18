import React from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { RoleBadge } from '../common/RoleBadge';
import { forumActivity } from '../../data/portal';

export function ForumActivityList() {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
      {forumActivity.map((item) =>
      <li key={item.id}>
          <Link
          to="/forum"
          className="block px-4 py-3.5 transition-colors duration-fast ease-standard hover:bg-muted">
          
            <p className="eyebrow text-muted-foreground">{item.category}</p>
            <h3 className="mt-1 text-base font-medium tracking-tight text-foreground">
              {item.title}
            </h3>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{item.author}</span>
              <RoleBadge role={item.role} />
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                <MessageSquare aria-hidden="true" className="h-3.5 w-3.5" />
                {item.replies} replies
              </span>
              <span aria-hidden="true">·</span>
              <span>{item.lastActivity}</span>
            </p>
          </Link>
        </li>
      )}
    </ul>);

}