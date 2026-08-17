import { parseAnnouncementBody } from "@/lib/announcements/validate";

export function AnnouncementBody({ source }: { source: string }) {
  const segments = parseAnnouncementBody(source);
  return (
    <p className="text-foreground">
      {segments.map((segment, index) => {
        switch (segment.type) {
          case "text":
            return <span key={index}>{segment.value}</span>;
          case "bold":
            return (
              <strong key={index} className="font-medium">
                {segment.value}
              </strong>
            );
          case "emphasis":
            return <em key={index}>{segment.value}</em>;
          case "link":
            return (
              <a key={index} className="text-foreground underline" href={segment.href}>
                {segment.label}
              </a>
            );
          default: {
            const exhaustive: never = segment;
            return exhaustive;
          }
        }
      })}
    </p>
  );
}
