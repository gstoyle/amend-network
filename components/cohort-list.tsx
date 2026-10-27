"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cardClassName } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type CohortFormState = {
  error?: string;
};

type CohortAction = (state: CohortFormState, formData: FormData) => Promise<CohortFormState>;

export type CohortListItem = {
  id: string;
  name: string;
  archived: boolean;
  memberCount: number;
};

export type CohortProgrammeGroup = {
  programRole: string;
  label: string;
  cohorts: CohortListItem[];
};

type CohortListProps = {
  groups: CohortProgrammeGroup[];
  createAction: CohortAction;
  renameAction: CohortAction;
  archiveAction: CohortAction;
};

const initialState: CohortFormState = {};

function FormError({ message }: { message?: string }) {
  return message ? (
    <p className="text-sm text-destructive" aria-live="polite" role="alert">
      {message}
    </p>
  ) : null;
}

function CreateCohortForm({
  action,
  groups,
}: {
  action: CohortAction;
  groups: CohortProgrammeGroup[];
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form
      action={formAction}
      className={cn(cardClassName, "flex flex-col gap-4 p-4 md:flex-row md:items-end")}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Label htmlFor="cohort-name">New cohort</Label>
        <Input id="cohort-name" maxLength={80} name="name" required type="text" />
      </div>
      <div className="flex flex-col gap-2 md:w-64">
        <Label htmlFor="cohort-programme">Programme</Label>
        <Select id="cohort-programme" name="programRole" required>
          <option value="">Select a programme</option>
          {groups.map((group) => (
            <option key={group.programRole} value={group.programRole}>
              {group.label}
            </option>
          ))}
        </Select>
      </div>
      <FormError message={state.error} />
      <Button disabled={pending} type="submit">
        {pending ? "Adding…" : "Add cohort"}
      </Button>
    </form>
  );
}

function CohortRow({
  cohort,
  renameAction,
  archiveAction,
}: {
  cohort: CohortListItem;
  renameAction: CohortAction;
  archiveAction: CohortAction;
}) {
  const [renameState, renameFormAction, renaming] = useActionState(renameAction, initialState);
  const [archiveState, archiveFormAction, archiving] = useActionState(archiveAction, initialState);
  const members = cohort.memberCount === 1 ? "1 member" : `${cohort.memberCount} members`;

  return (
    <li className={cn(cardClassName, "flex flex-col gap-3 p-4")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          className="font-semibold text-foreground underline-offset-4 hover:underline"
          href={`/admin/cohorts/${cohort.id}`}
        >
          {cohort.name}
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{members}</span>
          <Badge tone={cohort.archived ? "neutral" : "primary"}>
            {cohort.archived ? "Archived" : "Active"}
          </Badge>
        </div>
      </div>
      <form action={renameFormAction} className="flex flex-col gap-2">
        <Label htmlFor={`cohort-name-${cohort.id}`}>Cohort name</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input name="id" type="hidden" value={cohort.id} />
          <Input
            defaultValue={cohort.name}
            id={`cohort-name-${cohort.id}`}
            maxLength={80}
            name="name"
            required
            type="text"
          />
          <Button disabled={renaming} type="submit" variant="secondary">
            Save name
          </Button>
        </div>
        <FormError message={renameState.error} />
      </form>
      <form action={archiveFormAction} className="flex flex-col gap-2">
        <input name="id" type="hidden" value={cohort.id} />
        <input name="archived" type="hidden" value={cohort.archived ? "false" : "true"} />
        <div>
          <Button disabled={archiving} type="submit" variant="ghost">
            {cohort.archived ? "Unarchive" : "Archive"}
          </Button>
        </div>
        <FormError message={archiveState.error} />
      </form>
    </li>
  );
}

export function CohortList({ groups, createAction, renameAction, archiveAction }: CohortListProps) {
  return (
    <div className="flex flex-col gap-8">
      <CreateCohortForm action={createAction} groups={groups} />
      {groups.map((group) => (
        <section aria-labelledby={`cohorts-${group.programRole}`} className="flex flex-col gap-3" key={group.programRole}>
          <h2 className="text-lg font-semibold text-foreground" id={`cohorts-${group.programRole}`}>
            {group.label}
          </h2>
          {group.cohorts.length === 0 ? (
            <p className={cn(cardClassName, "border-dashed p-6 text-center text-sm text-muted-foreground")}>
              No cohorts yet.
            </p>
          ) : (
            <ul className="grid gap-3">
              {group.cohorts.map((cohort) => (
                <CohortRow
                  archiveAction={archiveAction}
                  cohort={cohort}
                  key={cohort.id}
                  renameAction={renameAction}
                />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
