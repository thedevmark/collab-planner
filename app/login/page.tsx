"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

function TwitchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
    </svg>
  );
}

function DiscordIcon({ className }: { className?: string }) {
  // Canonical Discord "Clyde" mark with eye cutouts — fair-use brand asset.
  // fillRule=evenodd makes the two eye subpaths render as holes in the body.
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" fillRule="evenodd" clipRule="evenodd">
      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.0615.0615 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9554 2.4189-2.1568 2.4189Zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9554 2.4189-2.1568 2.4189Z" />
    </svg>
  );
}

// Rotating pool of mock Discord friend handles — one is picked at random per page load
// so the hero demo feels alive and name-checks real streamers in Mark's orbit.
// Each friend has a deterministic emoji icon paired in — zero network cost (vs per-user
// avatar PNGs), zero runtime calc (vs hash → color → letter pipeline), and every visible
// avatar instance for that friend reads from the same const. System emoji fonts render
// these as full-color glyphs on every modern OS.
const ROTATING_DM_FRIENDS = [
  { name: "thedeutschmark", handle: "thedeutschmark", icon: "🎤" },
  { name: "a1exzandra",     handle: "a1exzandra",     icon: "🌙" },
  { name: "OOKVOID",        handle: "ookvoid",        icon: "👾" },
  { name: "DANGERDORK",     handle: "dangerdork",     icon: "⚡" },
  { name: "Koryzma",        handle: "koryzma",        icon: "🔥" },
  { name: "aerisoncam",     handle: "aerisoncam",     icon: "🎨" },
];

// Your own avatar on the "you" side of the DM loop. Fixed — it's Mark's side of the chat.
const ME_ICON = "🐉";

// Mock "Best windows" data — mirrors the real FindTimeView output shape
const MOCK_SLOTS = [
  { when: "Tue · 8–10 PM", match: 92, scores: [95, 88, 92] },
  { when: "Wed · 9–11 PM", match: 84, scores: [78, 90, 85] },
  { when: "Sat · 7–9 PM",  match: 76, scores: [72, 75, 82] },
];

// Single DM bubble for the Discord loop mock
function DMLine({ who, icon, color, time, muted, children }: {
  who: string;
  icon: string;
  color: string;
  time: string;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2.5">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-[14px] leading-none shrink-0"
        style={{ backgroundColor: color + "25" }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-[12px] font-semibold" style={{ color }}>{who}</span>
          <span className="text-[9.5px] text-zinc-500">{time}</span>
        </div>
        <p className={`text-[12.5px] leading-snug mt-0.5 ${muted ? "text-zinc-400 italic" : "text-zinc-200"}`}>
          {children}
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  // Pick a random DM-demo friend after hydration. Initial state matches SSR (first entry)
  // so there's no hydration mismatch; the randomization happens on the client after mount.
  const [dmFriend, setDmFriend] = useState(ROTATING_DM_FRIENDS[0]);
  useEffect(() => {
    setDmFriend(
      ROTATING_DM_FRIENDS[Math.floor(Math.random() * ROTATING_DM_FRIENDS.length)]
    );
  }, []);

  // The rotating friend slots into the first (purple) row of the overlap card too,
  // so every visible reference to the DM partner stays in sync.
  const MOCK_FRIENDS = [
    { ...dmFriend, color: "#9147ff", window: "Tue 8 PM", live: true },
    { icon: "🎮", color: "#5865F2", name: "NexusPlays", handle: "nexusplays", window: "Tue 9 PM", live: false },
    { icon: "🏹", color: "#e0af68", name: "SilverArc", handle: "silverarc_tv", window: "Wed 7 PM", live: false },
  ];

  // OAuth handoff can feel instant-but-stuck: the user clicks, Supabase builds the redirect URL,
  // and there's a ~300-800ms gap before the browser actually leaves the page. Show a spinner in
  // every CTA + a sliding progress bar up top so the click always feels acknowledged.
  const [loginLoading, setLoginLoading] = useState(false);

  async function loginWithTwitch() {
    if (loginLoading) return;
    setLoginLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "twitch",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: "user:read:email",
        },
      });
      if (error) {
        console.error("[login] Twitch OAuth failed:", error);
        setLoginLoading(false);
      }
      // On success the browser is about to navigate to Twitch — keep the spinner up.
    } catch (err) {
      console.error("[login] Twitch OAuth threw:", err);
      setLoginLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex flex-col overflow-x-hidden">

      {/* Top progress bar — YouTube/GitHub-style indeterminate slider while OAuth hands off. */}
      {loginLoading && (
        <div
          className="fixed top-0 left-0 right-0 h-[2px] z-50 overflow-hidden bg-[#9147ff]/15"
          role="progressbar"
          aria-label="Connecting to Twitch"
        >
          <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-[#9147ff] to-transparent animate-[loginProgressSlide_1.1s_ease-in-out_infinite]" />
          {/* Global scope — Tailwind's arbitrary-value `animate-[loginProgressSlide_…]`
              looks up the keyframe by its unscoped name, so styled-jsx can't hash it. */}
          <style jsx global>{`
            @keyframes loginProgressSlide {
              0%   { transform: translateX(-100%); }
              100% { transform: translateX(400%); }
            }
          `}</style>
        </div>
      )}

      {/* Nav */}
      <header className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto w-full">
        <div className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Collab Planner" width={144} height={80} />
        </div>
        <button
          onClick={loginWithTwitch}
          disabled={loginLoading}
          className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-200 transition-colors disabled:opacity-60 disabled:cursor-wait"
        >
          {loginLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <TwitchIcon className="h-3.5 w-3.5" />
          )}
          {loginLoading ? "Connecting…" : "Sign in"}
        </button>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center text-center px-6 pt-16 pb-12 relative">

        {/* Background glow — purple + teal, matches the logo rings */}
        <div className="absolute top-0 left-[15%] w-[480px] h-[260px] bg-[#7c3aed]/[0.07] rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-8 right-[15%] w-[480px] h-[260px] bg-[#14b8a6]/[0.05] rounded-full blur-[120px] pointer-events-none" />

        <div className="relative max-w-2xl mx-auto space-y-6">

          {/* Live pulse chip */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <span>free &amp; open</span>
          </div>

          {/* Headline */}
          <div className="space-y-4">
            <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight leading-[1.05] text-white">
              Stop scheduling<br />
              <span className="bg-gradient-to-r from-[#a78bfa] to-[#5eead4] bg-clip-text text-transparent">collabs over DMs.</span>
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
              disabled={loginLoading}
              aria-busy={loginLoading}
              className="inline-flex items-center gap-3 bg-[#9147ff] hover:bg-[#7d2ff7] active:scale-[0.98] text-white font-bold py-3.5 px-7 rounded-xl transition-all duration-150 shadow-[0_0_24px_rgba(145,71,255,0.22)] hover:shadow-[0_0_36px_rgba(145,71,255,0.32)] text-sm disabled:cursor-wait disabled:hover:bg-[#9147ff] disabled:active:scale-100"
            >
              {loginLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connecting to Twitch…
                </>
              ) : (
                <>
                  <TwitchIcon className="h-4 w-4" />
                  Connect with Twitch — it&apos;s free
                </>
              )}
            </button>
            <p className="text-[11.5px] text-zinc-500">
              {loginLoading ? "redirecting you to twitch…" : "just your twitch login · nothing to install"}
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
              className="px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900/60 text-[11.5px] text-zinc-400"
            >
              {pill}
            </span>
          ))}
        </div>
      </main>

      {/* Hero demo: the DM death loop → overlap calendar */}
      <section className="px-4 sm:px-6 pb-16 max-w-5xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-5 md:gap-4 items-center">

          {/* LEFT — Discord DM loop (the pain) */}
          <div className="rounded-2xl border border-zinc-800/80 bg-[#313338] overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)]">
            {/* Discord-style channel header */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-black/40 bg-[#2b2d31]">
              <DiscordIcon className="w-4 h-4 text-[#5865f2]" />
              <span className="text-[11px] font-semibold text-zinc-200">@{dmFriend.handle}</span>
              <span className="ml-auto text-[10.5px] text-zinc-500">direct message</span>
            </div>

            <div className="px-4 py-3 space-y-3">
              <DMLine who={dmFriend.name} icon={dmFriend.icon} color="#c4b5fd" time="Mon 8:42 PM">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/emotes/hicat.png"
                  alt="hiCat"
                  className="inline-block h-[1.35em] w-[1.35em] align-[-0.35em] mr-0.5"
                />
                hey wanna plan a stream together soon?
              </DMLine>
              <DMLine who="you" icon={ME_ICON} color="#5eead4" time="Mon 8:43 PM">
                sure when?
              </DMLine>
              <DMLine who={dmFriend.name} icon={dmFriend.icon} color="#c4b5fd" time="Mon 8:43 PM">
                idk — when can you? and what game?
              </DMLine>
              <DMLine who="you" icon={ME_ICON} color="#5eead4" time="Mon 8:44 PM">
                idk{" "}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/emotes/pain1.png"
                  alt="pain1"
                  className="inline-block h-[1.35em] w-[1.35em] align-[-0.35em]"
                />
                {" "}you don&apos;t post your schedule either
              </DMLine>
              <DMLine who={dmFriend.name} icon={dmFriend.icon} color="#c4b5fd" time="Mon 8:45 PM" muted>
                lol let&apos;s figure it out later
              </DMLine>
            </div>

            {/* Fake DM footer */}
            <div className="px-4 py-2 bg-[#383a40] border-t border-black/30 text-[11px] text-zinc-500 italic">
              later = never
            </div>
          </div>

          {/* ARROW */}
          <div className="flex justify-center items-center text-zinc-600 md:text-zinc-500 py-1 md:py-0">
            <svg
              className="w-9 h-9 md:w-10 md:h-10 rotate-90 md:rotate-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7m0 0l-7 7m7-7H4" />
            </svg>
          </div>

          {/* RIGHT — Find Time / overlap calendar (the fix). Teal-accented: this is "our tool" side. */}
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950 overflow-hidden shadow-[0_0_50px_rgba(20,184,166,0.12),0_0_40px_rgba(124,58,237,0.08)]">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800/80 bg-zinc-900/40">
              <svg className="w-3.5 h-3.5 text-[#14b8a6]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              <span className="text-[11.5px] font-semibold text-zinc-200">Best windows</span>
              <span className="ml-auto px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-500">America/New_York</span>
            </div>

            {/* Participants row */}
            <div className="flex items-center flex-wrap gap-1.5 px-4 py-2.5 border-b border-zinc-800/60">
              <span className="text-[10.5px] text-zinc-600 mr-1">with</span>
              {MOCK_FRIENDS.map((f) => (
                <div
                  key={f.handle}
                  className="flex items-center gap-1.5 pl-0.5 pr-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800"
                >
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] leading-none"
                    style={{ backgroundColor: f.color + "30" }}
                  >
                    {f.icon}
                  </span>
                  <span className="text-[10.5px] font-medium text-zinc-400">{f.name}</span>
                </div>
              ))}
            </div>

            {/* Ranked slots */}
            <div className="p-3 space-y-2">
              {MOCK_SLOTS.map((s, i) => (
                <div
                  key={s.when}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${
                    i === 0
                      ? "border-[#14b8a6]/30 bg-[#14b8a6]/[0.07]"
                      : "border-zinc-800/60"
                  }`}
                >
                  <span className={`text-xs font-bold w-5 text-right ${i === 0 ? "text-[#14b8a6]" : "text-zinc-500"}`}>
                    #{i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold ${i === 0 ? "text-zinc-100" : "text-zinc-300"}`}>
                        {s.when}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold uppercase tracking-wider ${
                          i === 0
                            ? "bg-[#14b8a6]/15 text-[#5eead4]"
                            : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        {s.match}% match
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      {MOCK_FRIENDS.map((f, fi) => (
                        <span
                          key={f.handle}
                          className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[9.5px] text-zinc-500"
                        >
                          {f.icon} {s.scores[fi]}%
                        </span>
                      ))}
                    </div>
                  </div>
                  {i === 0 && (
                    <button className="shrink-0 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-[#14b8a6] text-white hover:bg-[#0d9488] transition-colors">
                      Plan this
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Smart invite link footer */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-t border-zinc-800/60 bg-zinc-900/30">
              <svg className="w-3 h-3 text-zinc-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <span className="text-[10.5px] text-zinc-500 truncate">
                collab.deutschmark.online/invite/<span className="text-zinc-300">tue-8pm-eldenring</span>
              </span>
              <span className="ml-auto shrink-0 px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px] text-zinc-400">
                copy
              </span>
            </div>
          </div>
        </div>

        {/* Caption under the split */}
        <p className="mt-6 text-center text-[11.5px] text-zinc-600">
          same two streamers · no more guesswork
        </p>
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
              <span className={`text-xs font-bold tracking-wider ${accent ? "text-[#14b8a6]" : "text-zinc-600"}`}>
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
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 mb-5">
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
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[16px] leading-none border-2 border-zinc-950"
                    style={{ backgroundColor: f.color + "30" }}
                  >
                    {f.icon}
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-200">3 accepted</p>
                <p className="text-[11.5px] text-zinc-500">collab.deutschmark.online/invite/abc123</p>
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
          disabled={loginLoading}
          aria-busy={loginLoading}
          className="inline-flex items-center gap-3 bg-[#9147ff] hover:bg-[#7d2ff7] active:scale-[0.98] text-white font-bold py-3.5 px-7 rounded-xl transition-all duration-150 shadow-[0_0_24px_rgba(145,71,255,0.22)] text-sm disabled:cursor-wait disabled:hover:bg-[#9147ff] disabled:active:scale-100"
        >
          {loginLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Connecting to Twitch…
            </>
          ) : (
            <>
              <TwitchIcon className="h-4 w-4" />
              Get started free
            </>
          )}
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
          <span>© {new Date().getFullYear()} collab.deutschmark.online</span>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="hover:text-zinc-400 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-zinc-400 transition-colors">Terms</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
