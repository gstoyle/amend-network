import { formInsetClassName } from "@/components/ui/card";
import { checkboxClassName } from "@/components/ui/input";
import type { CohortOption, CohortProgram } from "@/lib/cohorts/list";
import { cohortToken, PROGRAM_LABELS } from "@/lib/db/program-labels";
import { cn } from "@/lib/utils";

const PROGRAMMES: CohortProgram[] = ["pathways", "lead"];

type VisibilityFieldsetProps = {
  /** Every cohort, archived included; archived ones only render when already selected. */
  cohorts: readonly CohortOption[];
  selected: readonly string[];
  includeEveryone?: boolean;
  className?: string;
};

function Choice({ checked, label, value }: { checked: boolean; label: string; value: string }) {
  return (
    <label className="flex min-h-touch items-center gap-2 text-sm text-foreground">
      <input
        className={checkboxClassName}
        defaultChecked={checked}
        name="visibility"
        type="checkbox"
        value={value}
      />
      {label}
    </label>
  );
}

export function VisibilityFieldset({
  cohorts,
  selected,
  includeEveryone = true,
  className,
}: VisibilityFieldsetProps) {
  const chosen = new Set(selected);
  return (
    <fieldset className={cn(formInsetClassName, "flex flex-col gap-3", className)}>
      <legend className="text-sm font-medium text-foreground">Visibility</legend>
      {includeEveryone ? (
        <Choice checked={chosen.has("all_authenticated")} label="Everyone signed in" value="all_authenticated" />
      ) : null}
      {PROGRAMMES.map((programme) => {
        const options = cohorts.filter(
          (cohort) =>
            cohort.programRole === programme &&
            (!cohort.archived || chosen.has(cohortToken(cohort.id))),
        );
        return (
          <fieldset className="flex flex-col gap-1" key={programme}>
            <legend className="text-sm font-medium text-muted-foreground">{PROGRAM_LABELS[programme]}</legend>
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <Choice
                checked={chosen.has(programme)}
                label={`All of ${PROGRAM_LABELS[programme]}`}
                value={programme}
              />
              {options.map((cohort) => (
                <Choice
                  checked={chosen.has(cohortToken(cohort.id))}
                  key={cohort.id}
                  label={cohort.archived ? `${cohort.name} (archived)` : cohort.name}
                  value={cohortToken(cohort.id)}
                />
              ))}
            </div>
          </fieldset>
        );
      })}
    </fieldset>
  );
}
