import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { Providers } from "@/components/providers";

export const viewport: Viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "SmartLedger Agent - 个人 AI 智能体助手",
  description: "SmartLedger Agent 是一款功能强大的个人 AI 智能体助手，集成了对话管理、记忆系统、任务执行和数据分析功能。",
  keywords: ["SmartLedger", "AVATAR", "AI Agent", "智能体", "助手", "记忆管理", "任务执行"],
  authors: [{ name: "SmartLedger Team" }],
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-96.png", sizes: "96x96", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-152.png", sizes: "152x152", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AVATAR",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="antialiased bg-background text-foreground">
        <Providers>{children}</Providers>
        <Script src="/sw-register.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
