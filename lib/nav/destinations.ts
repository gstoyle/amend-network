import { ADMIN_ROLES } from "@/lib/auth/admin-mfa";
import type { AdminRole, SessionClaims } from "@/lib/auth/types";
import { EVENT_STAFF_ROLES } from "@/lib/events/publish";

export type IconKey =
  | "home"
  | "resources"
  | "events"
  | "forum"
  | "directory"
  | "guide"
  | "account"
  | "shield";

export type Destination = {
  href: string;
  label: string;
  iconKey: IconKey;
  match: "exact" | "prefix";
};

/** The announcement/resource/user admin set. Moderator is deliberately outside it. */
const CONTENT_ADMIN_ROLES: AdminRole[] = ["admin", "super_admin"];

/**
 * Mirrors each route's own requireRole and never widens it. When a route's
 * check changes, change it here too or the entry becomes a dead end.
 */
const ADMIN_ENTRIES: { destination: Destination; allowed: AdminRole[] }[] = [
  {
    destination: { href: "/admin", label: "Admin home", iconKey: "shield", match: "exact" },
    allowed: ADMIN_ROLES,
  },
  {
    destination: {
      href: "/admin/analytics",
      label: "Analytics",
      iconKey: "shield",
      match: "prefix",
    },
    allowed: CONTENT_ADMIN_ROLES,
  },
  {
    destination: {
      href: "/admin/audit-log",
      label: "Audit log",
      iconKey: "shield",
      match: "prefix",
    },
    allowed: CONTENT_ADMIN_ROLES,
  },
  {
    destination: {
      href: "/admin/resources",
      label: "Resources",
      iconKey: "resources",
      match: "prefix",
    },
    allowed: CONTENT_ADMIN_ROLES,
  },
  {
    destination: { href: "/admin/events", label: "Events", iconKey: "events", match: "prefix" },
    allowed: EVENT_STAFF_ROLES,
  },
  {
    destination: { href: "/admin/forum", label: "Forum", iconKey: "forum", match: "prefix" },
    allowed: ADMIN_ROLES,
  },
  {
    destination: {
      href: "/admin/forum/flags",
      label: "Forum flags",
      iconKey: "shield",
      match: "prefix",
    },
    allowed: ADMIN_ROLES,
  },
  {
    destination: {
      href: "/admin/announcements",
      label: "Announcements",
      iconKey: "shield",
      match: "prefix",
    },
    allowed: CONTENT_ADMIN_ROLES,
  },
  {
    destination: {
      href: "/admin/users/pending",
      label: "Pending users",
      iconKey: "account",
      match: "prefix",
    },
    allowed: CONTENT_ADMIN_ROLES,
  },
  {
    destination: {
      href: "/admin/users/invite",
      label: "Invite",
      iconKey: "account",
      match: "prefix",
    },
    allowed: CONTENT_ADMIN_ROLES,
  },
  {
    destination: {
      href: "/admin/users/affiliations",
      label: "DOC affiliations",
      iconKey: "account",
      match: "prefix",
    },
    allowed: CONTENT_ADMIN_ROLES,
  },
];

/**
 * PRD Appendix B.4 order, then Guide. Forum sits between Events and Directory.
 */
const MEMBER_ENTRIES: Destination[] = [
  { href: "/app", label: "Home", iconKey: "home", match: "exact" },
  { href: "/app/resources", label: "Resources", iconKey: "resources", match: "prefix" },
  { href: "/app/events", label: "Events", iconKey: "events", match: "prefix" },
  { href: "/app/forum", label: "Forum", iconKey: "forum", match: "prefix" },
  { href: "/app/directory", label: "Directory", iconKey: "directory", match: "prefix" },
  { href: "/app/guide", label: "Guide", iconKey: "guide", match: "prefix" },
];

const ACCOUNT_ENTRIES: Destination[] = [
  {
    href: "/app/profile/privacy",
    label: "Directory privacy",
    iconKey: "account",
    match: "prefix",
  },
  {
    href: "/app/profile/sessions",
    label: "Active sessions",
    iconKey: "account",
    match: "prefix",
  },
];

function isActive(claims: SessionClaims | null): claims is SessionClaims {
  return claims !== null && claims.status === "active";
}

export function memberDestinations(claims: SessionClaims | null): Destination[] {
  return isActive(claims) ? [...MEMBER_ENTRIES] : [];
}

export function adminDestinations(claims: SessionClaims | null): Destination[] {
  if (!isActive(claims) || claims.adminRole === "none") {
    return [];
  }
  return ADMIN_ENTRIES.filter((entry) => entry.allowed.includes(claims.adminRole)).map(
    (entry) => entry.destination,
  );
}

export function accountDestinations(claims: SessionClaims | null): Destination[] {
  if (!isActive(claims)) {
    return [];
  }
  const entries = [...ACCOUNT_ENTRIES];
  if (claims.adminRole !== "none") {
    entries.push({ href: "/admin", label: "Admin", iconKey: "shield", match: "prefix" });
    if (!claims.mfaEnabled) {
      entries.push({
        href: "/mfa/enroll",
        label: "Set up authenticator",
        iconKey: "shield",
        match: "prefix",
      });
    }
  }
  return entries;
}

export function isCurrent(path: string, destination: Destination): boolean {
  if (path.length === 0) {
    return false;
  }
  if (destination.match === "exact") {
    return path === destination.href;
  }
  return path === destination.href || path.startsWith(`${destination.href}/`);
}

/** Longest href wins so a detail page marks one section, never two. */
export function currentDestination(
  path: string,
  destinations: Destination[],
): Destination | null {
  let best: Destination | null = null;
  for (const destination of destinations) {
    if (!isCurrent(path, destination)) {
      continue;
    }
    if (best === null || destination.href.length > best.href.length) {
      best = destination;
    }
  }
  return best;
}
