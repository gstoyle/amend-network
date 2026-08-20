import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function GuideSearchForm({ query }: { query: string }) {
  return (
    <section aria-labelledby="guide-search-heading">
      <h2 className="sr-only" id="guide-search-heading">
        Search the guide
      </h2>
      <form action="/app/guide" className="flex flex-col gap-3 lg:flex-row lg:items-end" method="get">
        <div className="min-w-0 flex-1">
          <Label className="mb-1.5 block" htmlFor="guide-search">
            Search the guide
          </Label>
          <div className="relative">
            <Icon
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              name="search"
            />
            <Input
              className="pl-9"
              defaultValue={query}
              id="guide-search"
              maxLength={200}
              name="q"
              placeholder="Sign in, forum, privacy…"
              type="search"
            />
          </div>
        </div>
        <Button className="lg:w-auto" type="submit">
          Search
        </Button>
      </form>
    </section>
  );
}
