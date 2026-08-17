"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type ResourceListItem = {
  id: string;
  title: string;
  visibility: string[];
  sourceLabel: string;
  deletedAt: string | null;
};

export type ResourceFormState = {
  message?: string;
  error?: string;
};

export type IngestSlotResult = {
  ingestId: string;
  filePutUrl: string;
  thumbPutUrl: string;
};

type ResourceFormProps = {
  mintAction: (fileMimeType: string, thumbMimeType: string) => Promise<IngestSlotResult>;
  publishAction: (
    state: ResourceFormState,
    formData: FormData,
  ) => Promise<ResourceFormState>;
};

const initialState: ResourceFormState = {};

const fieldClassName = cn(
  "flex min-h-touch w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
);

const VISIBILITY_OPTIONS = [
  { value: "all_authenticated", label: "Everyone signed in" },
  { value: "pathways", label: "Pathways only" },
  { value: "lead", label: "LEAD only" },
] as const;

export function ResourceForm({ mintAction, publishAction }: ResourceFormProps) {
  const [clientError, setClientError] = useState<string | undefined>();
  const [state, formAction, pending] = useActionState(
    async (prev: ResourceFormState, formData: FormData) => {
      setClientError(undefined);
      const file = formData.get("file");
      const thumbnail = formData.get("thumbnail");
      if (!(file instanceof File) || file.size === 0) {
        return { error: "A file is required." };
      }
      if (!(thumbnail instanceof File) || thumbnail.size === 0) {
        return { error: "A thumbnail is required." };
      }
      try {
        const slots = await mintAction(file.type, thumbnail.type);
        const [filePut, thumbPut] = await Promise.all([
          fetch(slots.filePutUrl, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": file.type || "application/octet-stream" },
          }),
          fetch(slots.thumbPutUrl, {
            method: "PUT",
            body: thumbnail,
            headers: { "Content-Type": thumbnail.type || "application/octet-stream" },
          }),
        ]);
        if (!filePut.ok || !thumbPut.ok) {
          return { error: "Upload did not complete." };
        }
        formData.set("ingestId", slots.ingestId);
        formData.set("fileMimeType", file.type);
        formData.set("fileSizeBytes", String(file.size));
        formData.set("thumbMimeType", thumbnail.type);
        formData.delete("file");
        formData.delete("thumbnail");
        return publishAction(prev, formData);
      } catch {
        setClientError("Could not publish this file.");
        return { error: "Could not publish this file." };
      }
    },
    initialState,
  );

  const error = clientError ?? state.error;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required type="text" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="previewText">Preview text</Label>
        <textarea
          className={fieldClassName}
          id="previewText"
          maxLength={500}
          name="previewText"
          required
          rows={4}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="sourceLabel">Source</Label>
        <select className={fieldClassName} id="sourceLabel" name="sourceLabel" required>
          <option value="Amend">Amend</option>
          <option value="Partner Org">Partner Org</option>
          <option value="External">External</option>
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="tags">Tags (comma-separated, up to 10)</Label>
        <Input id="tags" name="tags" type="text" />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-foreground">Visibility</legend>
        {VISIBILITY_OPTIONS.map((option) => (
          <label className="flex items-center gap-2 text-sm text-foreground" key={option.value}>
            <input name="visibility" type="checkbox" value={option.value} />
            {option.label}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-col gap-2">
        <Label htmlFor="file">File</Label>
        <Input
          accept=".pdf,.docx,.xlsx,.pptx,.jpg,.jpeg,.png,.mp4,application/pdf,image/jpeg,image/png,video/mp4"
          id="file"
          name="file"
          required
          type="file"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="thumbnail">Thumbnail</Label>
        <Input accept="image/jpeg,image/png" id="thumbnail" name="thumbnail" required type="file" />
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {state.message ? (
        <p className="text-sm text-foreground" role="status">
          {state.message}
        </p>
      ) : null}
      <Button disabled={pending} type="submit">
        {pending ? "Publishing…" : "Publish resource"}
      </Button>
    </form>
  );
}
