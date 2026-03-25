"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Calendar,
  CalendarPlus,
  ListChecks,
  Settings,
  Twitch,
  LogOut,
  Sun,
  Moon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/hooks/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useTheme } from "next-themes";
import Image from "next/image";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/calendar", label: "Calendar", icon: Calendar, exact: true },
  { href: "/events", label: "Event History", icon: ListChecks, exact: true },
  { href: "/events/new", label: "New Event", icon: CalendarPlus, exact: true },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();
  const { resolvedTheme, setTheme } = useTheme();

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const displayName = (user?.user_metadata?.full_name ?? user?.user_metadata?.preferred_username ?? "") as string;

  return (
    <aside className="fixed left-0 top-0 h-full w-56 border-r bg-card flex flex-col">
      <div className="flex items-center gap-2 p-4 border-b">
        <Twitch className="h-6 w-6 text-primary" />
        <span className="font-bold text-sm leading-tight">Collab<br />Planner</span>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
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
        <div className="p-3 border-t space-y-1">
          <div className="flex items-center gap-2 px-1 py-1">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={displayName}
                width={28}
                height={28}
                className="rounded-full"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold text-white">
                {displayName[0]?.toUpperCase() ?? "?"}
              </div>
            )}
            <span className="text-xs font-medium text-zinc-300 truncate">{displayName}</span>
          </div>
          <button
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            aria-label="Toggle theme"
          >
            {resolvedTheme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      )}
    </aside>
  );
}
