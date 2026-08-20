// Glyph geometry derived from Lucide (ISC License, https://lucide.dev).
// Inlined rather than installed: the shell needs a fixed handful of shapes and
// Constitution "Stack and Security Constraints" rules out a package for that.

export type IconName =
  | "home"
  | "resources"
  | "events"
  | "directory"
  | "account"
  | "shield"
  | "search"
  | "filter"
  | "close"
  | "announce"
  | "arrow-right"
  | "arrow-up-right"
  | "pin"
  | "check"
  | "download"
  | "lock"
  | "users"
  | "file"
  | "video"
  | "template"
  | "toolkit"
  | "slides"
  | "chevron-down"
  | "forum"
  | "guide";

const PATHS: Record<IconName, string[]> = {
  home: ["M3 10.5 12 3l9 7.5", "M5.25 9.75V21h13.5V9.75", "M9.75 21v-6h4.5v6"],
  resources: [
    "M4 4.5A1.5 1.5 0 0 1 5.5 3H18a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5.5A1.5 1.5 0 0 1 4 19.5z",
    "M4 17.5A1.5 1.5 0 0 1 5.5 16H19",
  ],
  events: [
    "M7 3v3M17 3v3",
    "M4 8.5A1.5 1.5 0 0 1 5.5 7h13A1.5 1.5 0 0 1 20 8.5v10A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5z",
    "M4 11h16",
  ],
  directory: [
    "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z",
    "M2.5 20a6.5 6.5 0 0 1 13 0",
    "M17 8.5a2.5 2.5 0 1 0 0-5",
    "M18 13.5a5.5 5.5 0 0 1 3.5 5",
  ],
  account: [
    "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
    "M4.5 20.5a7.5 7.5 0 0 1 15 0",
  ],
  shield: ["M12 3l7.5 3v5.5c0 4.5-3 8-7.5 9.5-4.5-1.5-7.5-5-7.5-9.5V6z", "M9.5 12l1.75 1.75L15 10"],
  search: ["M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z", "m16.2 16.2 4.3 4.3"],
  filter: ["M3.5 5h17l-6.75 8v6l-3.5-1.75V13z"],
  close: ["m6 6 12 12", "m18 6-12 12"],
  announce: [
    "M4 10a1 1 0 0 1 1-1h2l9-4v14l-9-4H5a1 1 0 0 1-1-1z",
    "M18.5 9.25a3.25 3.25 0 0 1 0 5.5",
  ],
  "arrow-right": ["M5 12h14", "m13 6 6 6-6 6"],
  "arrow-up-right": ["M7 17 17 7", "M9.5 7H17v7.5"],
  pin: [
    "M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z",
    "M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  ],
  check: ["m5 12.5 4.5 4.5L19 7.5"],
  download: ["M12 4v11", "m7.5 10.5 4.5 4.5 4.5-4.5", "M5 19.5h14"],
  lock: [
    "M7.5 11V8a4.5 4.5 0 0 1 9 0v3",
    "M5.5 11h13a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z",
  ],
  users: [
    "M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z",
    "M3.5 20a6.5 6.5 0 0 1 13 0",
    "M17.5 20a5 5 0 0 0-3-4.6",
    "M16 4.4a3.5 3.5 0 0 1 0 6.2",
  ],
  file: [
    "M14 3.5H7a1 1 0 0 0-1 1v15a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7.5z",
    "M14 3.5v4h4",
    "M9 13h6",
    "M9 16.5h4",
  ],
  video: [
    "M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z",
    "m10.5 9.4 4.6 2.6-4.6 2.6z",
  ],
  template: [
    "M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5V9H4z",
    "M4 12h6.25v8H4z",
    "M13.75 12H20v8h-6.25z",
  ],
  toolkit: [
    "M4 9.5A1.5 1.5 0 0 1 5.5 8h13A1.5 1.5 0 0 1 20 9.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z",
    "M9 8V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2",
    "M4 13h16",
  ],
  slides: [
    "M3 4h18",
    "M5 4v9.5A1.5 1.5 0 0 0 6.5 15h11a1.5 1.5 0 0 0 1.5-1.5V4",
    "m9 20 3-5 3 5",
  ],
  "chevron-down": ["m6 9 6 6 6-6"],
  forum: [
    "M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v9A1.5 1.5 0 0 1 18.5 17H8l-4 3v-13.5z",
  ],
  guide: [
    "M4 4.5A1.5 1.5 0 0 1 5.5 3H11v15H5.5A1.5 1.5 0 0 0 4 19.5z",
    "M20 4.5A1.5 1.5 0 0 0 18.5 3H13v15h5.5A1.5 1.5 0 0 1 20 19.5z",
    "M11 6h2",
  ],
};

export function Icon({ className, name }: { className?: string; name: IconName }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.75"
      viewBox="0 0 24 24"
    >
      {PATHS[name].map((d) => (
        <path d={d} key={d} />
      ))}
    </svg>
  );
}
