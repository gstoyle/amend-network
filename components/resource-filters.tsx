import { Button } from "@/components/ui/button";
import { controlClassName, Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <form className="flex flex-col gap-4" method="get">
      <div className="flex flex-col gap-2">
        <Label htmlFor="resource-q">Search</Label>
        <Input defaultValue={query.q ?? ""} id="resource-q" name="q" type="search" />
      </div>

      {tags.length > 0 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-foreground">Tags</legend>
          <ul className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <li key={tag}>
                <label className="inline-flex min-h-touch items-center gap-2 px-2 text-foreground">
                  <input
                    className="size-4"
                    defaultChecked={selectedTags.has(tag)}
                    name="tag"
                    type="checkbox"
                    value={tag}
                  />
                  {tag}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="resource-source">Source</Label>
        <select
          className={controlClassName}
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
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="resource-sort">Sort</Label>
        <select
          className={controlClassName}
          defaultValue={query.sort ?? "newest"}
          id="resource-sort"
          name="sort"
        >
          {SORTS.map((sort) => (
            <option key={sort.value} value={sort.value}>
              {sort.label}
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
