"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import Link from "next/link";

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
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.016.043.037.054a19.957 19.957 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
    </svg>
  );
}

// Mock friend data for the UI preview
const MOCK_FRIENDS = [
  { initials: "KR", color: "#9147ff", name: "KiroStreams", handle: "kirostreams", window: "Tue 8 PM", live: true },
  { initials: "NX", color: "#5865F2", name: "NexusPlays", handle: "nexusplays", window: "Tue 9 PM", live: false },
  { initials: "SA", color: "#e0af68", name: "SilverArc", handle: "silverarc_tv", window: "Wed 7 PM", live: false },
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
    <div className="min-h-screen bg-[#09090b] text-white flex flex-col overflow-x-hidden">

      {/* Nav */}
      <header className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" width={45} height={30} style={{ imageRendering: "pixelated" }} />
          <span className="font-bold text-sm text-zinc-200 tracking-tight">Collab Planner</span>
        </div>
        <button
          onClick={loginWithTwitch}
          className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-200 transition-colors"
        >
          <TwitchIcon className="h-3.5 w-3.5" />
          Sign in
        </button>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center text-center px-6 pt-16 pb-12 relative">

        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-[#9147ff]/8 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative max-w-2xl mx-auto space-y-6">

          {/* Live pulse chip */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <span className="font-mono">free &amp; open</span>
          </div>

          {/* Headline */}
          <div className="space-y-4">
            <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight leading-[1.05] text-white">
              Stop scheduling<br />
              <span className="text-[#9147ff]">collabs over DMs.</span>
            </h1>
            <p className="text-base text-zinc-400 leading-relaxed max-w-md mx-auto">
              It looks at when everyone actually streams, finds the overlap,
              and posts to your Discord when you lock something in.
            </p>
          </div>

          {/* CTA */}
          <div className="flex flex-col items-center gap-2.5">
            <button
              onClick={loginWithTwitch}
              className="inline-flex items-center gap-3 bg-[#9147ff] hover:bg-[#7d2ff7] active:scale-[0.98] text-white font-bold py-3.5 px-7 rounded-xl transition-all duration-150 shadow-[0_0_30px_rgba(145,71,255,0.3)] hover:shadow-[0_0_50px_rgba(145,71,255,0.45)] text-sm"
            >
              <TwitchIcon className="h-4 w-4" />
              Connect with Twitch — it&apos;s free
            </button>
            <p className="text-[11px] font-mono text-zinc-600">
              just your twitch login · nothing to install
            </p>
          </div>
        </div>

        {/* Capability pills */}
        <div className="relative mt-12 flex flex-wrap justify-center gap-2 max-w-xl mx-auto">
          {[
            "reads your VOD history",
            "finds schedule overlaps",
            "smart collab links",
            "posts to Discord",
            "tracks who you collab with",
          ].map((pill) => (
            <span
              key={pill}
              className="px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900/60 text-[11px] font-mono text-zinc-500"
            >
              {pill}
            </span>
          ))}
        </div>
      </main>

      {/* UI Preview */}
      <section className="px-6 pb-16 max-w-2xl mx-auto w-full">
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950 overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.6)]">

          {/* Fake window chrome */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800/80 bg-zinc-900/60">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-zinc-700" />
              <div className="w-3 h-3 rounded-full bg-zinc-700" />
              <div className="w-3 h-3 rounded-full bg-zinc-700" />
            </div>
            <div className="flex-1 flex justify-center">
              <span className="text-[11px] font-mono text-zinc-600">collab.deutschmark.online/friends</span>
            </div>
          </div>

          {/* App preview content */}
          <div className="p-5 space-y-3">

            {/* Section label */}
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Your Crew</span>
              <span className="text-[11px] font-mono text-zinc-600">3 tracked</span>
            </div>

            {/* Friend rows */}
            {MOCK_FRIENDS.map((f) => (
              <div key={f.handle} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/60">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                  style={{ backgroundColor: f.color + "26", border: `1px solid ${f.color}40` }}
                >
                  <span style={{ color: f.color }}>{f.initials}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-zinc-200">{f.name}</span>
                    {f.live && (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/15 border border-red-500/25 text-[9px] font-bold text-red-400 uppercase tracking-wider">
                        <span className="w-1 h-1 rounded-full bg-red-500" />
                        Live
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-mono text-zinc-600">@{f.handle}</span>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[11px] font-mono text-zinc-500">next window</div>
                  <div className="text-xs font-semibold text-[#9147ff]">{f.window}</div>
                </div>
              </div>
            ))}

            {/* Best window callout */}
            <div className="mt-1 flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[#9147ff]/20 bg-[#9147ff]/5">
              <div className="w-7 h-7 rounded-lg bg-[#9147ff]/15 flex items-center justify-center shrink-0">
                <svg className="w-3.5 h-3.5 text-[#9147ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-zinc-200">Best collab window</div>
                <div className="text-[11px] font-mono text-zinc-500">Tuesday · 8–10 PM ET · 3 of 3 available</div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#9147ff]/15 text-[#9147ff] border border-[#9147ff]/25 shrink-0">
                schedule it
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto w-full px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-zinc-800/50 rounded-2xl overflow-hidden border border-zinc-800/50">
          {[
            {
              step: "01",
              title: "Connect your Twitch",
              body: "Sign in and your stream history is already loaded. No forms, no manual entry.",
            },
            {
              step: "02",
              title: "Add your crew",
              body: "It spots people from your past collabs and suggests them. You just confirm who you actually play with.",
            },
            {
              step: "03",
              title: "Pick a time, send it",
              body: "Choose from the windows that work for everyone. It posts to Discord and creates a server event.",
              accent: true,
            },
          ].map(({ step, title, body, accent }) => (
            <div
              key={step}
              className="bg-zinc-950 px-7 py-8 space-y-3 group"
            >
              <span className={`text-xs font-mono font-bold ${accent ? "text-[#9147ff]" : "text-zinc-600"}`}>
                {step}
              </span>
              <h3 className="font-semibold text-white text-sm leading-snug">{title}</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Smart Links */}
      <section className="max-w-5xl mx-auto w-full px-6 pb-20">
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 font-mono mb-5">
            smart collab links
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Drop a link. Everyone&apos;s in.
          </h2>
          <p className="mt-3 text-sm text-zinc-400 max-w-lg mx-auto leading-relaxed">
            One URL carries the title, game, participants, and a personal message. Anyone who clicks
            can accept, decline, or claim the session — even if they&apos;ve never signed up.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-zinc-800/50 rounded-2xl overflow-hidden border border-zinc-800/50">
          {[
            {
              emoji: "🔗",
              title: "Share one link",
              body: "Create an invite with a title, game, and message. Pick who you want. Copy the link. Paste it in Discord, DMs, anywhere.",
            },
            {
              emoji: "👥",
              title: "Auto-add friends",
              body: "When someone claims your invite, they get added to your crew automatically — with their full stream history and schedule already loaded.",
            },
            {
              emoji: "📋",
              title: "Pre-filled event",
              body: "Clicking \"Claim & Plan\" drops them straight into event creation with the title, game, and participants already set. Zero re-typing.",
            },
            {
              emoji: "📊",
              title: "See who's in",
              body: "The invite page shows live status — who accepted, who declined, who's still thinking. Everyone sees the same state in real time.",
            },
          ].map(({ emoji, title, body }) => (
            <div
              key={title}
              className="bg-zinc-950 px-7 py-7 space-y-2.5"
            >
              <span className="text-xl">{emoji}</span>
              <h3 className="font-semibold text-white text-sm leading-snug">{title}</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">{body}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-zinc-800/60 bg-zinc-950 px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {MOCK_FRIENDS.map((f) => (
                  <div
                    key={f.handle}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-zinc-950"
                    style={{ backgroundColor: f.color + "30", color: f.color }}
                  >
                    {f.initials}
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-200">3 accepted</p>
                <p className="text-[11px] font-mono text-zinc-600">collab.deutschmark.online/invite/abc123</p>
              </div>
            </div>
            <div className="sm:ml-auto flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[10px] font-semibold text-emerald-400">
                3 accepted
              </span>
              <span className="px-2.5 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-[10px] font-semibold text-zinc-400">
                0 pending
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="text-center px-6 pb-20 space-y-5">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white">That&apos;s basically it.</h2>
          <p className="text-sm text-zinc-500">
            Less time in DMs figuring out when everyone&apos;s free.
          </p>
        </div>
        <button
          onClick={loginWithTwitch}
          className="inline-flex items-center gap-3 bg-[#9147ff] hover:bg-[#7d2ff7] active:scale-[0.98] text-white font-bold py-3.5 px-7 rounded-xl transition-all duration-150 shadow-[0_0_30px_rgba(145,71,255,0.3)] text-sm"
        >
          <TwitchIcon className="h-4 w-4" />
          Get started free
        </button>
        <div className="flex items-center justify-center gap-4 text-[11px] text-zinc-600">
          <span className="flex items-center gap-1.5">
            <DiscordIcon className="h-3 w-3" />
            Discord integration included
          </span>
          <span className="text-zinc-800">·</span>
          <span className="flex items-center gap-1.5">
            <TwitchIcon className="h-3 w-3" />
            Twitch OAuth only
          </span>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800/50 py-5 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-700">
          <span className="font-mono">© {new Date().getFullYear()} collab.deutschmark.online</span>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="hover:text-zinc-400 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-zinc-400 transition-colors">Terms</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
