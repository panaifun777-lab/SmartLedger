'use client'

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";

/**
 * Client-side providers wrapper.
 *
 * Root layout is a Server Component, which cannot directly render Context
 * Providers (SessionProvider/ThemeProvider) — that causes "React Context
 * is unavailable in Server Components" during static prerender of /_not-found.
 *
 * Solution: wrap all client providers in this single Client Component
 * and render it from the Server Component layout.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        {children}
      </ThemeProvider>
      <Toaster />
    </SessionProvider>
  );
}
