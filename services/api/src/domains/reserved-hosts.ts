/**
 * System-reserved host labels and tenant slugs that must never be assigned to clients.
 */
export const RESERVED_SLUGS = [
  "www",
  "platform",
  "admin",
  "api",
  "app",
  "apps",
  "auth",
  "billing",
  "cdn",
  "docs",
  "help",
  "mail",
  "status",
  "support",
  "static",
  "assets",
  "sokoos",
  "null",
  "undefined",
  "localhost",
  "local",
  "test",
  "staging",
  "prod",
  "production",
  "demo-platform",
] as const;

export function isReservedSlug(slug: string): boolean {
  const s = slug.trim().toLowerCase();
  if (!s) return true;
  if (RESERVED_SLUGS.includes(s as (typeof RESERVED_SLUGS)[number])) return true;
  if (s.startsWith("platform-")) return true;
  if (s.length < 2 || s.length > 63) return true;
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(s)) return true;
  return false;
}

export function normalizeHostname(raw: string): string {
  let h = raw.trim().toLowerCase();
  // Strip scheme if a full URL was passed
  h = h.replace(/^https?:\/\//, "");
  h = h.split("/")[0] ?? h;
  // Strip port
  if (h.includes(":") && !h.startsWith("[")) {
    h = h.split(":")[0] ?? h;
  }
  // Trailing dot
  if (h.endsWith(".")) h = h.slice(0, -1);
  return h;
}

export type HostKind =
  | "empty"
  | "ip"
  | "localhost"
  | "platform"
  | "public"
  | "managed_subdomain"
  | "other";

export function classifyHostShape(
  hostname: string,
  baseDomain: string,
  platformHost: string,
  publicHosts: string[],
): { kind: HostKind; slug?: string } {
  if (!hostname) return { kind: "empty" };
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.startsWith("[")) {
    return { kind: "ip" };
  }
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    if (hostname === "localhost") return { kind: "localhost" };
    const slug = hostname.slice(0, -".localhost".length);
    return { kind: "managed_subdomain", slug };
  }
  if (hostname === platformHost || hostname === `platform.${baseDomain}`) {
    return { kind: "platform" };
  }
  if (publicHosts.includes(hostname) || hostname === baseDomain || hostname === `www.${baseDomain}`) {
    return { kind: "public" };
  }
  if (baseDomain && hostname.endsWith(`.${baseDomain}`)) {
    const slug = hostname.slice(0, -(baseDomain.length + 1));
    if (slug && !slug.includes(".")) {
      return { kind: "managed_subdomain", slug };
    }
  }
  return { kind: "other" };
}
