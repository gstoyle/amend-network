import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const SOURCES = ["Amend", "Partner Org", "External"] as const;
const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "downloads", label: "Most downloaded" },
  { value: "title", label: "Alphabetical" },
] as const;

export type ResourceFilterValues = {
  q?: string;
  tags?: string[];
  source?: string;
  sort?: string;
};

export function ResourceFilters({
  tags,
  query,
}: {
  tags: string[];
  query: ResourceFilterValues;
}) {
  const selectedTags = new Set(query.tags ?? []);
  return (
    <section aria-labelledby="resource-filters-heading" className="border-y border-border py-4">
      <h2 className="sr-only" id="resource-filters-heading">
        Search and filter resources
      </h2>

      <form className="flex flex-col gap-4" method="get">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex-1">
            <Label className="mb-1.5 block" htmlFor="resource-q">
              Search resources
            </Label>
            <div className="relative">
              <Icon
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                name="search"
              />
              <Input
                className="pl-9"
                defaultValue={query.q ?? ""}
                id="resource-q"
                name="q"
                placeholder="Title or description"
                type="search"
              />
            </div>
          </div>

          <div className="lg:w-56">
            <Label className="mb-1.5 block" htmlFor="resource-source">
              Source
            </Label>
            <Select
              defaultValue={query.source ?? ""}
              id="resource-source"
              name="source"
            >
              <option value="">All sources</option>
              {SOURCES.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </Select>
          </div>

          <div className="lg:w-56">
            <Label className="mb-1.5 block" htmlFor="resource-sort">
              Sort
            </Label>
            <Select
              defaultValue={query.sort ?? "newest"}
              id="resource-sort"
              name="sort"
            >
              {SORTS.map((sort) => (
                <option key={sort.value} value={sort.value}>
                  {sort.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {tags.length > 0 ? (
          <fieldset>
            <legend className="mb-2 flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Icon className="size-4 text-muted-foreground" name="filter" />
              Filter by topic
            </legend>
            <ul className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <li key={tag}>
                  {/* A real checkbox: `checked` conveys pressed state natively and
                      toggling is inherently reversible, with no client scripting. */}
                  <label className="inline-flex cursor-pointer rounded-full">
                    <input
                      className="peer sr-only"
                      defaultChecked={selectedTags.has(tag)}
                      name="tag"
                      type="checkbox"
                      value={tag}
                    />
                    <span
                      className={cn(
                        "inline-flex min-h-touch items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors duration-fast ease-standard",
                        "border-border-strong bg-card text-foreground hover:bg-muted",
                        "peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground",
                        "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring",
                      )}
                    >
                      {tag}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" variant="outline">
            Apply
          </Button>
        </div>
      </form>
    </section>
  );
}
