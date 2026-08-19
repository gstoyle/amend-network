import { Button } from "@/components/ui/button";
import type { AuditLogFilterValues } from "@/components/audit-log-filters";

export function AuditLogExport({
  canExport,
  values,
}: {
  canExport: boolean;
  values: AuditLogFilterValues;
}) {
  if (!canExport) {
    return null;
  }
  return (
    <form action="/admin/audit-log/export" className="flex flex-col gap-2" method="post">
      {values.actor ? <input name="actor" type="hidden" value={values.actor} /> : null}
      {values.action ? <input name="action" type="hidden" value={values.action} /> : null}
      {values.from ? <input name="from" type="hidden" value={values.from} /> : null}
      {values.to ? <input name="to" type="hidden" value={values.to} /> : null}
      {values.severity ? <input name="severity" type="hidden" value={values.severity} /> : null}
      <Button type="submit">Export CSV</Button>
    </form>
  );
}
