import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { ThemeProvider } from "@/components/ThemeProvider";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: "Collab Planner",
  description: "Plan stream collabs with your Twitch friends",
  // Favicons are auto-registered from app/icon.svg and app/favicon.ico
  // (Venn-only, readable at 16/32/48px). /logo.svg is the wordmark for in-app use.
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? headersList.get("x-invoke-path") ?? "";
  const isAuthPage =
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/invite") ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/terms");

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" disableTransitionOnChange>
        {isAuthPage ? (
          children
        ) : (
          <AppShell>{children}</AppShell>
        )}
        </ThemeProvider>
      </body>
    </html>
  );
}
