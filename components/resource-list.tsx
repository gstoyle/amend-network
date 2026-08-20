import Link from "next/link";
import { ResourceCard, type ResourceCardData } from "@/components/resource-card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ResourceList({
  filtersActive = false,
  resources,
}: {
  filtersActive?: boolean;
  resources: ResourceCardData[];
}) {
  if (resources.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border-strong bg-card px-6 py-12 text-center">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {filtersActive ? "No resources match those filters" : "No resources are available"}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {filtersActive
            ? "Try removing a topic filter or searching a broader term."
            : "Nothing has been published to the library for your programme yet."}
        </p>
        {filtersActive ? (
          <Link
            className={cn(buttonVariants({ variant: "outline" }), "mt-5")}
            href="/app/resources"
          >
            Clear filters
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {resources.map((resource) => (
        <li key={resource.id}>
          <ResourceCard resource={resource} />
        </li>
      ))}
    </ul>
  );
}
