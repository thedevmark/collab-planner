"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Calendar,
  LayoutDashboard,
  Users,
  CalendarPlus,
  ListChecks,
  Settings,
  Twitch,
  LogOut,
  RotateCcw,
  Sun,
  Moon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/hooks/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useTheme } from "next-themes";
import Image from "next/image";
import useSWR from "swr";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const navItems = [
  { href: "/", label: "Home", icon: LayoutDashboard, exact: true },
  { href: "/friends", label: "People", icon: Users },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/events/new", label: "New Session", icon: CalendarPlus, exact: true },
  { href: "/events", label: "History", icon: ListChecks, exact: true },
  { href: "/settings", label: "Settings", icon: Settings },
];

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.016.043.037.054a19.957 19.957 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
    </svg>
  );
}

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ mobileOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();
  const { resolvedTheme, setTheme } = useTheme();
  const [restartingOnboarding, setRestartingOnboarding] = useState(false);

  const { data: settings } = useSWR(user ? "/api/settings" : null, fetcher, {
    revalidateOnFocus: false,
  });

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function handleRestartOnboarding() {
    setRestartingOnboarding(true);
    try {
      const res = await fetch("/api/profile/onboarding", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to restart onboarding");
      onClose?.();
      router.push("/");
      router.refresh();
    } finally {
      setRestartingOnboarding(false);
    }
  }

  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const displayName = (user?.user_metadata?.full_name ?? user?.user_metadata?.preferred_username ?? "") as string;
  const twitchUsername = (user?.user_metadata?.user_name ?? user?.user_metadata?.preferred_username ?? "") as string;
  const discordConnected = Boolean(settings?.discordUsername);

  return (
    <TooltipProvider delayDuration={300}>
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-56 border-r bg-card flex flex-col",
        "transition-transform duration-200 ease-in-out",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        "lg:translate-x-0",
      )}>
        <div className="flex items-center justify-between gap-2 p-4 border-b">
          <Link href="/" className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="Collab Planner" width={144} height={80} style={{ imageRendering: "pixelated" }} />
          </Link>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors lg:hidden"
              aria-label="Close menu"
            >
              ✕
            </button>
          )}
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {navItems.map(({ href, label, icon: Icon, exact }) => {
            const isActive = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-zinc-800/50 text-zinc-100 border-l-2 border-primary pl-[10px]"
                    : "text-muted-foreground hover:bg-zinc-900 hover:text-zinc-200"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        {user && (
          <div className="p-3 border-t space-y-0.5">
            {/* User identity */}
            <div className="flex items-center gap-2.5 px-2 py-2 mb-1">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={displayName}
                  width={30}
                  height={30}
                  className="rounded-full shrink-0"
                />
              ) : (
                <div className="w-[30px] h-[30px] rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
                  {displayName[0]?.toUpperCase() ?? "?"}
                </div>
              )}
              <span className="text-xs font-medium text-zinc-300 truncate">{displayName}</span>
            </div>

            {/* Platform connection badges */}
            <div className="flex items-center gap-2 px-2 pb-2.5">
              {/* Twitch — always connected */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#9147ff]/10 border border-[#9147ff]/25 cursor-default select-none">
                    <Twitch className="h-3 w-3 text-[#9147ff]" />
                    <span className="text-[10px] font-semibold tracking-wide text-[#9147ff]">Twitch</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.7)] ml-0.5" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <p className="font-medium">Twitch connected</p>
                  {twitchUsername && <p className="text-muted-foreground">@{twitchUsername}</p>}
                </TooltipContent>
              </Tooltip>

              {/* Discord — connected or not */}
              <Tooltip>
                <TooltipTrigger asChild>
                  {discordConnected ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#5865F2]/10 border border-[#5865F2]/25 cursor-default select-none">
                      <DiscordIcon className="h-3 w-3 text-[#5865F2]" />
                      <span className="text-[10px] font-semibold tracking-wide text-[#5865F2]">Discord</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.7)] ml-0.5" />
                    </div>
                  ) : (
                    <Link
                      href="/settings"
                      onClick={onClose}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-dashed border-zinc-600 hover:border-[#5865F2]/40 hover:bg-[#5865F2]/5 transition-colors group"
                    >
                      <DiscordIcon className="h-3 w-3 text-zinc-500 group-hover:text-[#5865F2]/70 transition-colors" />
                      <span className="text-[10px] font-semibold tracking-wide text-zinc-500 group-hover:text-[#5865F2]/70 transition-colors">Discord</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 ml-0.5" />
                    </Link>
                  )}
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {discordConnected ? (
                    <>
                      <p className="font-medium">Discord connected</p>
                      <p className="text-muted-foreground">@{settings.discordUsername}</p>
                      {settings.discordGuildName && settings.discordChannelName && (
                        <p className="text-muted-foreground">{settings.discordGuildName} · #{settings.discordChannelName}</p>
                      )}
                      {settings.discordGuildName && !settings.discordChannelName && (
                        <p className="text-yellow-400/80">No channel selected yet</p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="font-medium">Discord not connected</p>
                      <p className="text-muted-foreground">Click to set up in Settings</p>
                    </>
                  )}
                </TooltipContent>
              </Tooltip>
            </div>

            <button
              onClick={handleRestartOnboarding}
              disabled={restartingOnboarding}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5 shrink-0" />
              {restartingOnboarding ? "Restarting..." : "Restart onboarding"}
            </button>
            <button
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              aria-label="Toggle theme"
            >
              {resolvedTheme === "dark" ? <Sun className="h-3.5 w-3.5 shrink-0" /> : <Moon className="h-3.5 w-3.5 shrink-0" />}
              {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
            </button>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              Sign out
            </button>
          </div>
        )}
      </aside>
    </TooltipProvider>
  );
}
