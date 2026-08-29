"use client";

import { useRef, type ReactNode } from "react";
import {
  deletePostAction,
  deleteThreadAction,
} from "@/app/(member)/app/forum/actions";
import { Button } from "@/components/ui/button";
import { formInsetClassName } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

function ConfirmDelete({
  action,
  ariaLabel,
  children,
  confirmLabel,
  description,
  title,
  titleId,
}: {
  action: (formData: FormData) => Promise<void>;
  ariaLabel: string;
  children: ReactNode;
  confirmLabel: string;
  description: string;
  title: string;
  titleId: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  function close() {
    dialogRef.current?.close();
  }

  return (
    <>
      <Button
        aria-haspopup="dialog"
        aria-label={ariaLabel}
        className="shrink-0"
        onClick={() => dialogRef.current?.showModal()}
        type="button"
        variant="ghost"
      >
        Delete
      </Button>
      <dialog
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-card-foreground shadow-lg backdrop:bg-foreground/40"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            close();
          }
        }}
        ref={dialogRef}
      >
        <form action={action} className="flex flex-col gap-5">
          {children}
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-foreground" id={titleId}>
              {title}
            </h2>
            <Button aria-label="Close" onClick={close} type="button" variant="ghost">
              <Icon className="size-4" name="close" />
            </Button>
          </div>
          <p className={cn(formInsetClassName, "text-sm text-muted-foreground")}>{description}</p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={close} type="button" variant="outline">
              Cancel
            </Button>
            <Button type="submit" variant="destructive">
              {confirmLabel}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}

export function ForumDeletePostControl({
  authorLabel,
  postId,
  threadId,
}: {
  authorLabel: string;
  postId: string;
  threadId: string;
}) {
  return (
    <ConfirmDelete
      action={deletePostAction}
      ariaLabel={`Delete post by ${authorLabel}`}
      confirmLabel="Delete post"
      description="It will disappear from the discussion. The record stays in the audit log."
      title="Delete this post?"
      titleId={`delete-post-title-${postId}`}
    >
      <input name="threadId" type="hidden" value={threadId} />
      <input name="postId" type="hidden" value={postId} />
    </ConfirmDelete>
  );
}

export function ForumDeleteThreadControl({
  slug,
  threadId,
  title,
}: {
  slug: string;
  threadId: string;
  title: string;
}) {
  return (
    <ConfirmDelete
      action={deleteThreadAction}
      ariaLabel={`Delete thread ${title}`}
      confirmLabel="Delete thread"
      description="The discussion will leave the category list. Posts stay in the audit trail."
      title="Delete this thread?"
      titleId={`delete-thread-title-${threadId}`}
    >
      <input name="threadId" type="hidden" value={threadId} />
      <input name="slug" type="hidden" value={slug} />
    </ConfirmDelete>
  );
}
