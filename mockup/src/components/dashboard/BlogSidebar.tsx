import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { blogPosts } from '../../data/portal';

export function BlogSidebar() {
  return (
    <section aria-labelledby="blog-heading" className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <p className="eyebrow text-muted-foreground">From the blog</p>
        <h2 id="blog-heading" className="mt-1 text-base font-semibold tracking-tight text-foreground">
          Public writing
        </h2>
      </div>

      <ul className="divide-y divide-border">
        {blogPosts.map((post) =>
        <li key={post.id}>
            <a
            href="#post"
            className="block px-4 py-3 transition-colors duration-fast ease-standard hover:bg-muted">
            
              <h3 className="text-sm font-medium leading-snug text-foreground">
                {post.title}
                <ArrowUpRight aria-hidden="true" className="ml-1 inline h-3.5 w-3.5 align-text-top text-muted-foreground" />
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {post.author} · {post.publishedAt} · {post.readTime}
              </p>
            </a>
          </li>
        )}
      </ul>

      <div className="border-t border-border px-4 py-3">
        <a
          href="#blog"
          className="inline-flex min-h-tap items-center text-sm font-medium text-primary underline decoration-border-strong underline-offset-4 hover:decoration-primary">
          
          Visit the public blog
        </a>
      </div>
    </section>);

}