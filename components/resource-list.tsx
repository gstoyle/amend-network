import { ResourceCard, type ResourceCardData } from "@/components/resource-card";

export function ResourceList({ resources }: { resources: ResourceCardData[] }) {
  if (resources.length === 0) {
    return <p className="text-foreground">No resources are available.</p>;
  }
  return (
    <ul className="flex flex-col gap-6">
      {resources.map((resource) => (
        <li key={resource.id}>
          <ResourceCard resource={resource} />
        </li>
      ))}
    </ul>
  );
}
