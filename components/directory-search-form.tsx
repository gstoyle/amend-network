import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DirectorySearchForm({
  query,
  error,
}: {
  query: string;
  error?: string;
}) {
  return (
    <form action="/app/directory" className="flex max-w-xl flex-col gap-3" method="get">
      <label className="flex flex-col gap-2 text-foreground" htmlFor="directory-search">
        Search members
        <Input
          defaultValue={query}
          id="directory-search"
          maxLength={200}
          name="q"
          type="search"
        />
      </label>
      {error ? (
        <p aria-live="polite" className="text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit">Search</Button>
    </form>
  );
}
