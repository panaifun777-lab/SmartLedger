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
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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

function hasSessionCookie(req: NextRequest): boolean {
  const cookies = req.cookies;
  if (cookies.has("next-auth.session-token")) return true;
  if (cookies.has("__Secure-next-auth.session-token")) return true;
  return false;
}

/**
 * Resolve the canonical app origin.
 *
 * Priority:
 *   1. NEXTAUTH_URL env var (most reliable — explicitly configured)
 *   2. X-Forwarded-Proto + X-Forwarded-Host headers (set by reverse proxy)
 *   3. req.nextUrl.origin (last resort — may be 0.0.0.0 inside Docker)
 *
 * Without this, when Caddy proxies to `avatar-agent:3000`, Next.js sees
 * the request as coming from 0.0.0.0:3000 and generates redirect URLs
 * pointing at 0.0.0.0:3000 — which the user's browser cannot reach.
 */
function getCanonicalOrigin(req: NextRequest): string {
  const envUrl = process.env.NEXTAUTH_URL?.trim();
  if (envUrl) return envUrl.replace(/\/$/, "");

  const xfp = req.headers.get("x-forwarded-proto");
  const xfh = req.headers.get("x-forwarded-host");
  if (xfh) {
    const proto = xfp || "https";
    return `${proto}://${xfh}`;
  }

  return req.nextUrl.origin;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  for (const pattern of PUBLIC_PATHS) {
    if (pattern.test(pathname)) {
      return NextResponse.next();
    }
  }

  if (!hasSessionCookie(req)) {
    const origin = getCanonicalOrigin(req);
    const loginUrl = new URL("/login", origin);
    // Preserve the original path (not the full URL with 0.0.0.0 host)
    loginUrl.searchParams.set("callbackUrl", `${origin}${req.nextUrl.pathname}${req.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_next/data|api/auth|api/health|login|favicon\\.ico|favicon\\.png|robots\\.txt|manifest\\.json|sw\\.js|sw-register\\.js|icons|generated|upload).*)",
  ],
};
