export const RESOURCE_SOURCES = ["Amend", "Members"] as const;

export type ResourceSource = (typeof RESOURCE_SOURCES)[number];

export const RESOURCE_SOURCE_COPY: Record<
  ResourceSource,
  { label: string; formHelp: string; sectionTitle: string; sectionDescription: string }
> = {
  Amend: {
    label: "Amend",
    formHelp: "Amend publishes or stands behind this.",
    sectionTitle: "From Amend",
    sectionDescription: "Materials Amend publishes or stands behind.",
  },
  Members: {
    label: "Members",
    formHelp: "Shared by a member. Not an Amend endorsement.",
    sectionTitle: "Shared by members",
    sectionDescription: "Peer materials. Amend has not endorsed these.",
  },
};

export const RESOURCE_TOPIC_SUGGESTIONS = [
  "Policies",
  "Curriculum",
  "Facilitation",
  "Training",
  "Reentry",
  "Wellbeing",
  "Program design",
  "Peer support",
] as const;

export function isResourceSource(value: string): value is ResourceSource {
  return (RESOURCE_SOURCES as readonly string[]).includes(value);
}

export function parseOptionalFolderId(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return null;
  }
  return trimmed;
}
