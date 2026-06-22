/**
 * Route protection proxy (Next.js 16 replaces `middleware.ts` with `proxy.ts`).
 *
 * Checks for a NextAuth session cookie. If absent, redirect to /login.
 *
 * Allow-list (no auth required):
 *   - /api/auth/*      — NextAuth endpoints (login, callback, session)
 *   - /api/health      — Docker HEALTHCHECK probe
 *   - /login           — login page itself
 *   - /_next/*         — Next.js static assets
 *   - favicon, icons, sw, manifest, robots, generated, upload
 *
 * Everything else requires a valid session cookie.
 *
 * We deliberately do NOT use `next-auth/middleware` (withAuth) because it
 * depends on the deprecated middleware convention. Instead we do a direct
 * cookie presence check — the JWT signature is verified by NextAuth on
 * the API side, so an attacker forging a cookie header would still get
 * rejected on actual API calls.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Match paths that should bypass auth. */
const PUBLIC_PATHS = [
  /^\/api\/auth\//,
  /^\/api\/health$/,
  /^\/login/,
  /^\/_next\//,
  /^\/favicon\.(ico|png)$/,
  /^\/robots\.txt$/,
  /^\/manifest\.json$/,
  /^\/sw\.js$/,
  /^\/sw-register\.js$/,
  /^\/icons\//,
  /^\/generated\//,
  /^\/upload\//,
];

/** NextAuth cookie name. v4 uses `next-auth.session-token` (HTTP) or
 *  `__Secure-next-auth.session-token` (HTTPS). We check both. */
function hasSessionCookie(req: NextRequest): boolean {
  const cookies = req.cookies;
  if (cookies.has("next-auth.session-token")) return true;
  if (cookies.has("__Secure-next-auth.session-token")) return true;
  return false;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public paths bypass auth
  for (const pattern of PUBLIC_PATHS) {
    if (pattern.test(pathname)) {
      return NextResponse.next();
    }
  }

  // Authed paths require a session cookie
  if (!hasSessionCookie(req)) {
    const loginUrl = new URL("/login", req.url);
    // Preserve the original URL so we can redirect back after login
    loginUrl.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_next/data|api/auth|api/health|login|favicon\\.ico|favicon\\.png|robots\\.txt|manifest\\.json|sw\\.js|sw-register\\.js|icons|generated|upload).*)",
  ],
};
