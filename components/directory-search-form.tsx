import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DirectorySearchForm({
  query,
  error,
}: {
  query: string;
  error?: string;
}) {
  return (
    <section aria-labelledby="directory-search-heading" className="border-y border-border py-4">
      <h2 className="sr-only" id="directory-search-heading">
        Search members
      </h2>
      <form action="/app/directory" className="flex flex-col gap-3 lg:flex-row lg:items-end" method="get">
        <div className="min-w-0 flex-1">
          <Label className="mb-1.5 block" htmlFor="directory-search">
            Search members
          </Label>
          <div className="relative">
            <Icon
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              name="search"
            />
            <Input
              className="pl-9"
              defaultValue={query}
              id="directory-search"
              maxLength={200}
              name="q"
              placeholder="Name or network"
              type="search"
            />
          </div>
        </div>
        <Button className="lg:w-auto" type="submit">
          Search
        </Button>
      </form>
      {error ? (
        <p aria-live="polite" className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
