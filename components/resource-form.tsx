"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { controlClassName, Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

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

export type ResourceFormInitial = {
  id: string;
  title: string;
  previewText: string;
  sourceLabel: string;
  tags: string[];
  visibility: string[];
};

type ResourceFormProps = {
  mintAction: (fileMimeType: string, thumbMimeType: string) => Promise<IngestSlotResult>;
  publishAction?: (
    state: ResourceFormState,
    formData: FormData,
  ) => Promise<ResourceFormState>;
  saveAction?: (
    state: ResourceFormState,
    formData: FormData,
  ) => Promise<ResourceFormState>;
  initial?: ResourceFormInitial;
};

const initialState: ResourceFormState = {};

const VISIBILITY_OPTIONS = [
  { value: "all_authenticated", label: "Everyone signed in" },
  { value: "pathways", label: "Pathways only" },
  { value: "lead", label: "LEAD only" },
] as const;

export function ResourceForm({
  mintAction,
  publishAction,
  saveAction,
  initial,
}: ResourceFormProps) {
  const [clientError, setClientError] = useState<string | undefined>();
  const isEdit = Boolean(initial);
  const [state, formAction, pending] = useActionState(
    async (prev: ResourceFormState, formData: FormData) => {
      setClientError(undefined);
      const file = formData.get("file");
      const thumbnail = formData.get("thumbnail");
      const hasFile = file instanceof File && file.size > 0;
      const hasThumb = thumbnail instanceof File && thumbnail.size > 0;

      if (!isEdit) {
        if (!hasFile) {
          return { error: "A file is required." };
        }
        if (!hasThumb) {
          return { error: "A thumbnail is required." };
        }
      } else if (hasFile !== hasThumb) {
        return { error: "Upload both a replacement file and thumbnail, or neither." };
      }

      if (hasFile && hasThumb && file instanceof File && thumbnail instanceof File) {
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
        } catch {
          const message = isEdit
            ? "Could not save this resource."
            : "Could not publish this file.";
          setClientError(message);
          return { error: message };
        }
      }
      formData.delete("file");
      formData.delete("thumbnail");

      if (isEdit) {
        return saveAction ? saveAction(prev, formData) : { error: "Could not save this resource." };
      }
      return publishAction
        ? publishAction(prev, formData)
        : { error: "Could not publish this file." };
    },
    initialState,
  );

  const error = clientError ?? state.error;
  const selected = new Set(initial?.visibility ?? []);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {initial ? <input name="resourceId" type="hidden" value={initial.id} /> : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Title</Label>
        <Input defaultValue={initial?.title ?? ""} id="title" name="title" required type="text" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="previewText">Preview text</Label>
        <textarea
          className={controlClassName}
          defaultValue={initial?.previewText ?? ""}
          id="previewText"
          maxLength={500}
          name="previewText"
          required
          rows={4}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="sourceLabel">Source</Label>
        <Select
          defaultValue={initial?.sourceLabel ?? "Amend"}
          id="sourceLabel"
          name="sourceLabel"
          required
        >
          <option value="Amend">Amend</option>
          <option value="Partner Org">Partner Org</option>
          <option value="External">External</option>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="tags">Tags (comma-separated, up to 10)</Label>
        <Input
          defaultValue={initial?.tags.join(", ") ?? ""}
          id="tags"
          name="tags"
          type="text"
        />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-foreground">Visibility</legend>
        {VISIBILITY_OPTIONS.map((option) => (
          <label className="flex items-center gap-2 text-sm text-foreground" key={option.value}>
            <input
              defaultChecked={selected.has(option.value)}
              name="visibility"
              type="checkbox"
              value={option.value}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-col gap-2">
        <Label htmlFor="file">{isEdit ? "Replacement file (optional)" : "File"}</Label>
        <Input
          accept=".pdf,.docx,.xlsx,.pptx,.jpg,.jpeg,.png,.mp4,application/pdf,image/jpeg,image/png,video/mp4"
          id="file"
          name="file"
          required={!isEdit}
          type="file"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="thumbnail">{isEdit ? "Replacement thumbnail (optional)" : "Thumbnail"}</Label>
        <Input
          accept="image/jpeg,image/png"
          id="thumbnail"
          name="thumbnail"
          required={!isEdit}
          type="file"
        />
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
        {pending ? (isEdit ? "Saving…" : "Publishing…") : isEdit ? "Save" : "Publish resource"}
      </Button>
    </form>
  );
}
