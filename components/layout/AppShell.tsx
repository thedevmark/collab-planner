"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="lg:ml-56 flex flex-col min-h-screen">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 px-4 h-12 border-b bg-background lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="Collab Planner" width={72} height={40} style={{ imageRendering: "pixelated" }} />
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </>
  );
}
