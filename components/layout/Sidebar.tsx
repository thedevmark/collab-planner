"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Calendar,
  CalendarPlus,
  MessageSquare,
  Settings,
  Twitch,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/calendar", label: "Calendar", icon: Calendar, exact: true },
  { href: "/events/new", label: "New Event", icon: CalendarPlus, exact: true },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-full w-56 border-r bg-card flex flex-col">
      <div className="flex items-center gap-2 p-4 border-b">
        <Twitch className="h-6 w-6 text-primary" />
        <span className="font-bold text-sm leading-tight">Twitch Collab<br />Organizer</span>
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
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 text-xs text-muted-foreground border-t">
        Single-user collab planner
      </div>
    </aside>
  );
}
