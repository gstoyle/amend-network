"use client";

import { useActionState } from "react";
import type { CohortFormState } from "@/components/cohort-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cardClassName } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type CohortAction = (state: CohortFormState, formData: FormData) => Promise<CohortFormState>;

export type CohortMemberItem = {
  userId: string;
  name: string;
  primary: boolean;
  active: boolean;
};

type CohortMembersProps = {
  cohortId: string;
  archived: boolean;
  members: CohortMemberItem[];
  addAction: CohortAction;
  removeAction: CohortAction;
};

const initialState: CohortFormState = {};

function FormError({ message }: { message?: string }) {
  return message ? (
    <p className="text-sm text-destructive" aria-live="polite" role="alert">
      {message}
    </p>
  ) : null;
}

function MemberRow({
  cohortId,
  member,
  removeAction,
}: {
  cohortId: string;
  member: CohortMemberItem;
  removeAction: CohortAction;
}) {
  const [state, formAction, pending] = useActionState(removeAction, initialState);
  return (
    <li className={cn(cardClassName, "flex flex-col gap-2 p-4")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">{member.name}</span>
          {member.primary ? <Badge tone="primary">Primary cohort</Badge> : null}
          {member.active ? null : <Badge>Not active</Badge>}
        </div>
        {member.primary ? null : (
          <form action={formAction}>
            <input name="cohortId" type="hidden" value={cohortId} />
            <input name="userId" type="hidden" value={member.userId} />
            <Button aria-label={`Remove ${member.name}`} disabled={pending} type="submit" variant="ghost">
              Remove
            </Button>
          </form>
        )}
      </div>
      <FormError message={state.error} />
    </li>
  );
}

export function CohortMembers({ cohortId, archived, members, addAction, removeAction }: CohortMembersProps) {
  const [state, formAction, pending] = useActionState(addAction, initialState);

  return (
    <div className="flex flex-col gap-8">
      {archived ? (
        <p className={cn(cardClassName, "p-4 text-sm text-muted-foreground")}>
          This cohort is archived. Unarchive it from the cohort list to add members.
        </p>
      ) : (
        <form
          action={formAction}
          className={cn(cardClassName, "flex flex-col gap-4 p-4 sm:flex-row sm:items-end")}
        >
          <input name="cohortId" type="hidden" value={cohortId} />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Label htmlFor="member-email">Member email</Label>
            <Input autoComplete="off" id="member-email" name="email" required type="email" />
          </div>
          <FormError message={state.error} />
          <Button disabled={pending} type="submit">
            {pending ? "Adding…" : "Add member"}
          </Button>
        </form>
      )}

      <section aria-labelledby="cohort-members-heading" className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground" id="cohort-members-heading">
          Members
        </h2>
        {members.length === 0 ? (
          <p className={cn(cardClassName, "border-dashed p-6 text-center text-sm text-muted-foreground")}>
            No members in this cohort yet.
          </p>
        ) : (
          <ul className="grid gap-3">
            {members.map((member) => (
              <MemberRow cohortId={cohortId} key={member.userId} member={member} removeAction={removeAction} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
