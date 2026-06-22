/**
 * Route protection middleware.
 *
 * Allow-list (no auth required):
 *   - /api/auth/*           — NextAuth endpoints
 *   - /api/health           — health check (Docker HEALTHCHECK)
 *   - /login                — login page itself
 *   - /_next/*              — Next.js static assets
 *   - /favicon.ico, /robots.txt, /manifest.json, /sw.js, /sw-register.js
 *   - /icons/*              — PWA icons
 *   - /generated/*          — generated images (public)
 *   - /upload/*             — uploaded files (public)
 */
export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_next/data|api/auth|api/health|login|favicon\\.ico|favicon\\.png|robots\\.txt|manifest\\.json|sw\\.js|sw-register\\.js|icons|generated|upload).*)",
  ],
};
