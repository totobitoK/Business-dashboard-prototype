const LIVE_POST_LOGIN_PREFIXES = ["/dashboard", "/admin"] as const;

/**
 * Restrict post-login redirects to same-origin relative live app paths.
 */
export function sanitizeAuthRedirectPath(
  next: string | null | undefined,
  fallback = "/dashboard"
): string {
  if (!next) return fallback;

  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  if (next.includes("\\") || next.includes("@") || next.includes(":")) return fallback;

  const pathname = next.split("?")[0]?.split("#")[0] ?? "";
  const allowed = LIVE_POST_LOGIN_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  if (!allowed) return fallback;

  return pathname;
}
