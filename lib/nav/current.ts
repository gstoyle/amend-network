export type NavMatchMode = "exact" | "prefix";

/**
 * Zero-dependency so client nav components (which need this per-render via
 * usePathname) never pull server-only modules in through destinations.ts.
 */
export function isCurrentPath(path: string, href: string, mode: NavMatchMode): boolean {
  if (path.length === 0) {
    return false;
  }
  if (mode === "exact") {
    return path === href;
  }
  return path === href || path.startsWith(`${href}/`);
}
