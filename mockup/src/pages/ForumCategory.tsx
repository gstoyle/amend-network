import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, PenLine, ShieldCheck } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { ThreadRow } from '../components/forum/ThreadRow';
import { forumCategory, forumThreads } from '../data/portal';

export function ForumCategory() {
  const pinned = forumThreads.filter((thread) => thread.pinned);
  const rest = forumThreads.filter((thread) => !thread.pinned);

  return (
    <div className="space-y-6 lg:space-y-8">
      <nav aria-label="Breadcrumb">
        <Link
          to="/forum"
          className="inline-flex min-h-tap items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
          
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          All categories
        </Link>
      </nav>

      <header className="border-b border-border pb-6">
        <p className="eyebrow text-muted-foreground">Forum category</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground lg:text-3xl">
          {forumCategory.name}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{forumCategory.description}</p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{forumCategory.threadCount} threads</span>
            <span aria-hidden="true">·</span>
            <span>{forumCategory.memberCount} members following</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />
              {forumCategory.moderator}
            </span>
          </p>
          <Button className="min-h-tap w-full sm:w-auto">
            <PenLine aria-hidden="true" className="h-4 w-4" />
            New thread
          </Button>
        </div>
      </header>

      <section aria-labelledby="threads-heading">
        <h2 id="threads-heading" className="sr-only">
          Threads
        </h2>
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {pinned.map((thread) =>
          <ThreadRow key={thread.id} thread={thread} />
          )}
          {rest.map((thread) =>
          <ThreadRow key={thread.id} thread={thread} />
          )}
        </ul>
      </section>

      <p className="text-center text-sm text-muted-foreground">
        Showing {forumThreads.length} of {forumCategory.threadCount} threads.{' '}
        <a
          href="#more"
          className="font-medium text-primary underline decoration-border-strong underline-offset-4 hover:decoration-primary">
          
          Load older threads
        </a>
      </p>
    </div>);

}