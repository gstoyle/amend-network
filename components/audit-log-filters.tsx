import { Button } from "@/components/ui/button";
import { controlClassName, Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";

const SEVERITIES = ["info", "warning", "security"] as const;

export type AuditLogFilterValues = {
  actor?: string;
  action?: string;
  from?: string;
  to?: string;
  severity?: string;
};

export function AuditLogFilters({ values }: { values: AuditLogFilterValues }) {
  return (
    <form action="/admin/audit-log" className="flex max-w-xl flex-col gap-4" method="get">
      <div className="flex flex-col gap-2">
        <Label htmlFor="audit-actor">Actor</Label>
        <Input
          autoComplete="off"
          defaultValue={values.actor ?? ""}
          id="audit-actor"
          name="actor"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="audit-action">Action</Label>
        <select
          className={controlClassName}
          defaultValue={values.action ?? ""}
          id="audit-action"
          name="action"
        >
          <option value="">All actions</option>
          {AUDIT_ACTIONS.map((action) => (
            <option key={action} value={action}>
              {action}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="audit-from">From</Label>
        <Input defaultValue={values.from ?? ""} id="audit-from" name="from" type="date" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="audit-to">To</Label>
        <Input defaultValue={values.to ?? ""} id="audit-to" name="to" type="date" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="audit-severity">Severity</Label>
        <select
          className={controlClassName}
          defaultValue={values.severity ?? ""}
          id="audit-severity"
          name="severity"
        >
          <option value="">All severities</option>
          {SEVERITIES.map((severity) => (
            <option key={severity} value={severity}>
              {severity}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" variant="outline">
        Apply
      </Button>
    </form>
  );
}
