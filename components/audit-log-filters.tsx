import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
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
  const hasFilters = Object.values(values).some((value) => Boolean(value));

  return (
    <form action="/admin/audit-log" className="grid gap-4 md:grid-cols-2 xl:grid-cols-5" method="get">
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
        <Select
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
        </Select>
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
        <Select
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
        </Select>
      </div>
      <div className="flex flex-wrap gap-2 md:col-span-2 xl:col-span-5">
        <Button type="submit">Apply filters</Button>
        {hasFilters ? (
          <Link className={buttonVariants({ variant: "ghost" })} href="/admin/audit-log">
            Clear filters
          </Link>
        ) : null}
      </div>
    </form>
  );
}
