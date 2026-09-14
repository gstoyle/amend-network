"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { controlClassName, Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type MarkdownWrap,
  wrapMarkdownLink,
  wrapMarkdownSelection,
} from "@/lib/announcements/validate";

const LINK_ERROR = "Use an http(s) address or an in-app /app/ path.";

type FormattedBodyFieldProps = {
  id: string;
  name: string;
  defaultValue?: string;
  rows?: number;
  required?: boolean;
  maxLength?: number;
};

type Range = { start: number; end: number };

function applyToTextarea(
  field: HTMLTextAreaElement,
  next: { value: string; selectionStart: number; selectionEnd: number },
): void {
  field.value = next.value;
  field.focus();
  field.setSelectionRange(next.selectionStart, next.selectionEnd);
}

export function FormattedBodyField({
  id,
  name,
  defaultValue,
  rows = 6,
  required,
  maxLength,
}: FormattedBodyFieldProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const hrefRef = useRef<HTMLInputElement>(null);
  const rangeRef = useRef<Range>({ start: 0, end: 0 });
  const [linkError, setLinkError] = useState<string | null>(null);
  const hintId = `${id}-format-hint`;
  const dialogTitleId = `${id}-link-title`;
  const hrefFieldId = `${id}-link-href`;

  function currentRange(): Range {
    const field = textareaRef.current;
    if (!field) {
      return { start: 0, end: 0 };
    }
    return { start: field.selectionStart, end: field.selectionEnd };
  }

  function applyWrap(wrap: MarkdownWrap): void {
    const field = textareaRef.current;
    if (!field) {
      return;
    }
    const range = currentRange();
    applyToTextarea(field, wrapMarkdownSelection(field.value, range.start, range.end, wrap));
  }

  function openLinkDialog(): void {
    rangeRef.current = currentRange();
    setLinkError(null);
    if (hrefRef.current) {
      hrefRef.current.value = "";
    }
    dialogRef.current?.showModal();
    queueMicrotask(() => hrefRef.current?.focus());
  }

  function closeLinkDialog(): void {
    dialogRef.current?.close();
  }

  function insertLink(): void {
    const field = textareaRef.current;
    if (!field) {
      return;
    }
    const href = hrefRef.current?.value ?? "";
    const next = wrapMarkdownLink(
      field.value,
      rangeRef.current.start,
      rangeRef.current.end,
      href,
    );
    if (!next) {
      setLinkError(LINK_ERROR);
      hrefRef.current?.focus();
      return;
    }
    applyToTextarea(field, next);
    closeLinkDialog();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    const withModifier = event.metaKey || event.ctrlKey;
    if (!withModifier || event.altKey || event.shiftKey) {
      return;
    }
    const key = event.key.toLowerCase();
    if (key === "b") {
      event.preventDefault();
      applyWrap("bold");
      return;
    }
    if (key === "i") {
      event.preventDefault();
      applyWrap("italic");
      return;
    }
    if (key === "u") {
      event.preventDefault();
      applyWrap("underline");
      return;
    }
    if (key === "k") {
      event.preventDefault();
      openLinkDialog();
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div
        aria-controls={id}
        aria-label="Text formatting"
        className="flex flex-wrap gap-1"
        role="group"
      >
        <Button
          aria-keyshortcuts="Control+B Meta+B"
          aria-label="Bold"
          onClick={() => applyWrap("bold")}
          type="button"
          variant="outline"
        >
          <span aria-hidden="true" className="font-semibold">
            B
          </span>
        </Button>
        <Button
          aria-keyshortcuts="Control+I Meta+I"
          aria-label="Italic"
          onClick={() => applyWrap("italic")}
          type="button"
          variant="outline"
        >
          <span aria-hidden="true" className="italic">
            I
          </span>
        </Button>
        <Button
          aria-keyshortcuts="Control+U Meta+U"
          aria-label="Underline"
          onClick={() => applyWrap("underline")}
          type="button"
          variant="outline"
        >
          <span aria-hidden="true" className="underline">
            U
          </span>
        </Button>
        <Button
          aria-keyshortcuts="Control+K Meta+K"
          aria-label="Link"
          onClick={openLinkDialog}
          type="button"
          variant="outline"
        >
          Link
        </Button>
      </div>
      <p className="text-sm text-muted-foreground" id={hintId}>
        Select text, then choose a format. Links must start with http://, https://, or /app/.
      </p>
      <textarea
        aria-describedby={hintId}
        className={controlClassName}
        defaultValue={defaultValue}
        id={id}
        maxLength={maxLength}
        name={name}
        onKeyDown={onKeyDown}
        ref={textareaRef}
        required={required}
        rows={rows}
      />
      <dialog
        aria-labelledby={dialogTitleId}
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-card-foreground shadow-lg backdrop:bg-overlay"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            closeLinkDialog();
          }
        }}
        onClose={() => textareaRef.current?.focus()}
        ref={dialogRef}
      >
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold tracking-tight text-foreground" id={dialogTitleId}>
            Add a link
          </h2>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={hrefFieldId}>Address</Label>
            <Input
              autoComplete="off"
              id={hrefFieldId}
              onKeyDown={(event) => {
                if (event.key !== "Enter") {
                  return;
                }
                event.preventDefault();
                insertLink();
              }}
              placeholder="https:// or /app/…"
              ref={hrefRef}
            />
          </div>
          {linkError ? (
            <p className="text-sm text-destructive" role="alert">
              {linkError}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={closeLinkDialog} type="button" variant="outline">
              Cancel
            </Button>
            <Button onClick={insertLink} type="button">
              Insert link
            </Button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
