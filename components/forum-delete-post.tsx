"use client";

import { useRef } from "react";
import { deletePostAction } from "@/app/(member)/app/forum/actions";
import { Button } from "@/components/ui/button";
import { formInsetClassName } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export function ForumDeletePostControl({
  authorLabel,
  postId,
  threadId,
}: {
  authorLabel: string;
  postId: string;
  threadId: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = `delete-post-title-${postId}`;

  function close() {
    dialogRef.current?.close();
  }

  return (
    <>
      <Button
        aria-haspopup="dialog"
        aria-label={`Delete post by ${authorLabel}`}
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
        <form action={deletePostAction} className="flex flex-col gap-5">
          <input name="threadId" type="hidden" value={threadId} />
          <input name="postId" type="hidden" value={postId} />
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-foreground" id={titleId}>
              Delete this post?
            </h2>
            <Button aria-label="Close" onClick={close} type="button" variant="ghost">
              <Icon className="size-4" name="close" />
            </Button>
          </div>
          <p className={cn(formInsetClassName, "text-sm text-muted-foreground")}>
            It will disappear from the discussion. The record stays in the audit log.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={close} type="button" variant="outline">
              Cancel
            </Button>
            <Button type="submit" variant="destructive">
              Delete post
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
