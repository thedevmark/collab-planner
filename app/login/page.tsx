"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Calendar, Users, Bell } from "lucide-react";

function TwitchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
    </svg>
  );
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.016.043.037.054a19.957 19.957 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
    </svg>
  );
}

const features = [
  {
    icon: Users,
    title: "Know your crew's schedule",
    description:
      "See when your collab partners typically stream, spot overlap windows, and track who you've played with based on your VOD history.",
  },
  {
    icon: Calendar,
    title: "Lock in the perfect time",
    description:
      "Collab Planner analyzes your streaming patterns and your friends' schedules to surface the times that actually work for everyone.",
  },
  {
    icon: DiscordIcon,
    title: "Auto-post to Discord",
    description:
      "Connect your Discord once and let the app announce collabs, send reminders, and create server events — automatically.",
  },
];

export default function LoginPage() {
  async function loginWithTwitch() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: "twitch",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: "user:read:email",
      },
    });
  }

  return (
    <div className="min-h-screen bg-[#09030f] text-white flex flex-col">

      {/* Nav */}
      <header className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <TwitchIcon className="h-5 w-5 text-[#9147ff]" />
          <span className="font-bold text-sm text-zinc-200">Collab Planner</span>
        </div>
        <button
          onClick={loginWithTwitch}
          className="flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
        >
          <TwitchIcon className="h-4 w-4" />
          Sign in
        </button>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20 relative">
        {/* Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[#9147ff]/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative max-w-2xl mx-auto space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#9147ff]/30 bg-[#9147ff]/10 text-[#9147ff] text-xs font-medium">
            <TwitchIcon className="h-3 w-3" />
            Free for Twitch streamers
          </div>

          {/* Headline */}
          <div className="space-y-4">
            <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight leading-tight text-white">
              Plan collabs.<br />
              <span className="text-[#9147ff]">Grow together.</span>
            </h1>
            <p className="text-lg text-zinc-400 leading-relaxed max-w-lg mx-auto">
              The scheduling tool built for Twitch streamers who collab. Find
              the right time, invite your crew, and let Discord handle the
              announcements.
            </p>
          </div>

          {/* CTA */}
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={loginWithTwitch}
              className="inline-flex items-center gap-3 bg-[#9147ff] hover:bg-[#7d2ff7] active:scale-95 text-white font-bold py-4 px-8 rounded-xl transition-all duration-150 shadow-[0_0_40px_rgba(145,71,255,0.35)] hover:shadow-[0_0_60px_rgba(145,71,255,0.5)] text-base"
            >
              <TwitchIcon className="h-5 w-5" />
              Connect with Twitch — it&apos;s free
            </button>
            <p className="text-xs text-zinc-600">
              No account needed beyond Twitch. Takes 10 seconds.
            </p>
          </div>
        </div>
      </main>

      {/* Features */}
      <section className="max-w-5xl mx-auto w-full px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {features.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-6 space-y-3"
            >
              <div className="w-9 h-9 rounded-lg bg-[#9147ff]/10 border border-[#9147ff]/20 flex items-center justify-center">
                <Icon className="h-4 w-4 text-[#9147ff]" />
              </div>
              <h3 className="font-semibold text-white text-sm">{title}</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800/50 py-6 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-600">
          <span>© {new Date().getFullYear()} Collab Planner</span>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="hover:text-zinc-400 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-zinc-400 transition-colors">Terms of Service</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
