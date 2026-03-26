"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Loader2, Search, X } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface OnboardingModalProps {
  displayName: string;
  avatarUrl: string;
  friendCount?: number;
  onComplete: () => void | Promise<void>;
}

interface SessionFriend {
  id?: number;
  username: string;
  displayName: string;
  avatarUrl: string;
  source: "manual" | "suggested";
}

interface SuggestedFriend {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string;
}

const FALLBACK_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Australia/Sydney",
];

const TOTAL_STEPS = 4;

export default function OnboardingModal({
  displayName,
  avatarUrl,
  onComplete,
}: OnboardingModalProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [animating, setAnimating] = useState(false);

  // Friends state
  const [friendInput, setFriendInput] = useState("");
  const [addingFriend, setAddingFriend] = useState(false);
  const [friendError, setFriendError] = useState("");
  const [addedFriends, setAddedFriends] = useState<SessionFriend[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestedFriend[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  // Timezone state
  const [timezone, setTimezone] = useState("UTC");
  const [timezones, setTimezones] = useState<string[]>(FALLBACK_TIMEZONES);

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const supported =
      typeof Intl.supportedValuesOf === "function"
        ? Intl.supportedValuesOf("timeZone")
        : FALLBACK_TIMEZONES;
    setTimezone(detected);
    setTimezones(Array.from(new Set([detected, ...supported])));
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingSuggestions(true);
      try {
        await fetch("/api/friends/sync-suggestions", { method: "POST" }).catch(() => undefined);
        const res = await fetch("/api/friends?suggested=true");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data)) {
          setSuggestions(
            data
              .filter((f: { isMe?: boolean }) => !f.isMe)
              .slice(0, 8)
              .map((f: SuggestedFriend) => ({
                id: f.id,
                username: f.username,
                displayName: f.displayName,
                avatarUrl: f.avatarUrl ?? "",
              }))
          );
        }
      } finally {
        if (!cancelled) setLoadingSuggestions(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  function goTo(next: number, dir: "forward" | "back" = "forward") {
    if (animating) return;
    setDirection(dir);
    setAnimating(true);
    setTimeout(() => {
      setStep(next);
      setAnimating(false);
    }, 200);
  }

  function next() { goTo(step + 1, "forward"); }
  function back() { goTo(step - 1, "back"); }

  function pushFriend(friend: SessionFriend) {
    setAddedFriends((cur) => {
      const exists = cur.some((f) => f.username.toLowerCase() === friend.username.toLowerCase());
      return exists ? cur : [...cur, friend];
    });
  }

  async function addFriend() {
    const username = friendInput.trim();
    if (!username) return;
    if (addedFriends.some((f) => f.username.toLowerCase() === username.toLowerCase())) {
      setFriendError("Already added.");
      return;
    }
    setAddingFriend(true);
    setFriendError("");
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (!res.ok) { setFriendError(data.error ?? "Couldn't find that username."); return; }
      pushFriend({ id: data.id, username: data.username, displayName: data.displayName, avatarUrl: data.avatarUrl ?? "", source: "manual" });
      setFriendInput("");
    } catch {
      setFriendError("Network error. Try again.");
    } finally {
      setAddingFriend(false);
    }
  }

  async function confirmSuggestion(friend: SuggestedFriend) {
    setConfirmingId(friend.id);
    try {
      const res = await fetch(`/api/friends/${friend.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSuggested: false }),
      });
      if (!res.ok) return;
      pushFriend({ id: friend.id, username: friend.username, displayName: friend.displayName, avatarUrl: friend.avatarUrl, source: "suggested" });
      setSuggestions((cur) => cur.filter((f) => f.id !== friend.id));
    } finally {
      setConfirmingId(null);
    }
  }

  function removeFriend(username: string) {
    setAddedFriends((cur) => cur.filter((f) => f.username !== username));
  }

  async function finish() {
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/profile/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Something went wrong.");
      }
      await Promise.resolve(onComplete());
      router.push("/");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  const sessionUsernames = new Set(addedFriends.map((f) => f.username.toLowerCase()));
  const visibleSuggestions = suggestions.filter((f) => !sessionUsernames.has(f.username.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 bg-[#09030f] flex flex-col">

      {/* Progress dots */}
      <div className="flex justify-center gap-2 pt-10 pb-2">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "rounded-full transition-all duration-300",
              i === step
                ? "w-6 h-1.5 bg-[#9147ff]"
                : i < step
                ? "w-1.5 h-1.5 bg-[#9147ff]/50"
                : "w-1.5 h-1.5 bg-zinc-700"
            )}
          />
        ))}
      </div>

      {/* Step content */}
      <div className="flex-1 flex items-center justify-center px-6 overflow-y-auto">
        <div
          className={cn(
            "w-full max-w-md transition-all duration-200",
            animating
              ? direction === "forward"
                ? "opacity-0 translate-y-4"
                : "opacity-0 -translate-y-4"
              : "opacity-100 translate-y-0"
          )}
        >
          {step === 0 && (
            <WelcomeStep
              displayName={displayName}
              avatarUrl={avatarUrl}
              onNext={next}
            />
          )}
          {step === 1 && (
            <FriendsStep
              addedFriends={addedFriends}
              visibleSuggestions={visibleSuggestions}
              loadingSuggestions={loadingSuggestions}
              confirmingId={confirmingId}
              friendInput={friendInput}
              addingFriend={addingFriend}
              friendError={friendError}
              onInputChange={(v) => { setFriendInput(v); setFriendError(""); }}
              onAdd={addFriend}
              onConfirm={confirmSuggestion}
              onRemove={removeFriend}
              onNext={next}
              onBack={back}
            />
          )}
          {step === 2 && (
            <TimezoneStep
              timezone={timezone}
              timezones={timezones}
              onChange={setTimezone}
              onNext={next}
              onBack={back}
            />
          )}
          {step === 3 && (
            <FinishStep
              displayName={displayName}
              friendCount={addedFriends.length}
              timezone={timezone}
              submitting={submitting}
              submitError={submitError}
              onFinish={finish}
              onBack={back}
            />
          )}
        </div>
      </div>

    </div>
  );
}

// ── Step components ──────────────────────────────────────────────────────────

function WelcomeStep({
  displayName,
  avatarUrl,
  onNext,
}: {
  displayName: string;
  avatarUrl: string;
  onNext: () => void;
}) {
  return (
    <div className="text-center space-y-8">
      <div className="flex justify-center">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={displayName}
            width={72}
            height={72}
            className="rounded-full border-2 border-[#9147ff]/40 shadow-[0_0_24px_rgba(145,71,255,0.3)]"
          />
        ) : (
          <div className="w-18 h-18 rounded-full bg-zinc-800 flex items-center justify-center text-2xl font-bold text-white border-2 border-[#9147ff]/40">
            {displayName[0]?.toUpperCase() ?? "?"}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h1 className="text-3xl font-bold text-white">
          Hey {displayName || "streamer"} 👋
        </h1>
        <p className="text-zinc-400 text-base leading-relaxed">
          Welcome to Collab Planner. Let&apos;s take two minutes to set things up so
          you can start scheduling collabs right away.
        </p>
      </div>

      <div className="space-y-2.5 text-left">
        {[
          "Add the streamers you collab with",
          "Confirm your timezone",
          "Start scheduling from Home",
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-3 text-sm text-zinc-400">
            <div className="w-5 h-5 rounded-full bg-[#9147ff]/15 border border-[#9147ff]/30 flex items-center justify-center shrink-0">
              <Check className="w-3 h-3 text-[#9147ff]" />
            </div>
            {item}
          </div>
        ))}
      </div>

      <button
        onClick={onNext}
        className="w-full flex items-center justify-center gap-2 bg-[#9147ff] hover:bg-[#7d2ff7] text-white font-semibold py-3.5 rounded-xl transition-colors"
      >
        Let&apos;s go
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function FriendsStep({
  addedFriends,
  visibleSuggestions,
  loadingSuggestions,
  confirmingId,
  friendInput,
  addingFriend,
  friendError,
  onInputChange,
  onAdd,
  onConfirm,
  onRemove,
  onNext,
  onBack,
}: {
  addedFriends: SessionFriend[];
  visibleSuggestions: SuggestedFriend[];
  loadingSuggestions: boolean;
  confirmingId: number | null;
  friendInput: string;
  addingFriend: boolean;
  friendError: string;
  onInputChange: (v: string) => void;
  onAdd: () => void;
  onConfirm: (f: SuggestedFriend) => void;
  onRemove: (username: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold text-[#9147ff] uppercase tracking-widest">Step 2 of 4</p>
        <h2 className="text-2xl font-bold text-white">Who do you collab with?</h2>
        <p className="text-zinc-400 text-sm leading-relaxed">
          Add Twitch streamers you&apos;ve played with. You can always add more later.
        </p>
      </div>

      {/* Search input */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Enter Twitch username"
              value={friendInput}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onAdd()}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#9147ff]/60 transition-colors"
            />
          </div>
          <button
            onClick={onAdd}
            disabled={!friendInput.trim() || addingFriend}
            className="px-4 py-2.5 bg-[#9147ff] hover:bg-[#7d2ff7] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5"
          >
            {addingFriend ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
          </button>
        </div>
        {friendError && <p className="text-xs text-red-400">{friendError}</p>}
      </div>

      {/* Added friends */}
      {addedFriends.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {addedFriends.map((f) => (
            <div
              key={f.username}
              className="flex items-center gap-2 bg-zinc-800/80 border border-zinc-700 rounded-full pl-1.5 pr-2.5 py-1"
            >
              {f.avatarUrl ? (
                <Image src={f.avatarUrl} alt={f.displayName} width={20} height={20} className="rounded-full" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-zinc-700 flex items-center justify-center text-[9px] font-bold text-white">
                  {f.displayName[0]?.toUpperCase()}
                </div>
              )}
              <span className="text-xs text-zinc-200 font-medium">{f.displayName}</span>
              <button onClick={() => onRemove(f.username)} className="text-zinc-500 hover:text-zinc-300 transition-colors ml-0.5">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Suggestions */}
      {loadingSuggestions ? (
        <div className="flex items-center gap-2 text-zinc-500 text-sm">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Looking for suggestions…
        </div>
      ) : visibleSuggestions.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-zinc-500 font-medium">Detected from your past streams</p>
          <div className="grid grid-cols-2 gap-2">
            {visibleSuggestions.map((f) => (
              <button
                key={f.id}
                onClick={() => onConfirm(f)}
                disabled={confirmingId === f.id}
                className="flex items-center gap-2.5 p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-[#9147ff]/40 hover:bg-zinc-800/80 transition-all text-left disabled:opacity-60"
              >
                {f.avatarUrl ? (
                  <Image src={f.avatarUrl} alt={f.displayName} width={28} height={28} className="rounded-full shrink-0" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
                    {f.displayName[0]?.toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-medium text-white truncate">{f.displayName}</p>
                  <p className="text-[10px] text-zinc-500 truncate">@{f.username}</p>
                </div>
                {confirmingId === f.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400 ml-auto shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-zinc-600 ml-auto shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          className="px-4 py-3 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="flex-1 flex items-center justify-center gap-2 bg-[#9147ff] hover:bg-[#7d2ff7] text-white font-semibold py-3 rounded-xl transition-colors"
        >
          {addedFriends.length > 0 ? `Continue with ${addedFriends.length} friend${addedFriends.length !== 1 ? "s" : ""}` : "Skip for now"}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function TimezoneStep({
  timezone,
  timezones,
  onChange,
  onNext,
  onBack,
}: {
  timezone: string;
  timezones: string[];
  onChange: (tz: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const now = new Date();
  const formatted = now.toLocaleTimeString("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-xs font-semibold text-[#9147ff] uppercase tracking-widest">Step 3 of 4</p>
        <h2 className="text-2xl font-bold text-white">Where are you streaming from?</h2>
        <p className="text-zinc-400 text-sm leading-relaxed">
          All schedules and event times will show in your local timezone.
        </p>
      </div>

      <div className="space-y-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 text-center">
          <p className="text-4xl font-bold text-white tabular-nums">{formatted}</p>
          <p className="text-xs text-zinc-500 mt-1">{timezone}</p>
        </div>

        <select
          value={timezone}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#9147ff]/60 transition-colors"
        >
          {timezones.map((tz) => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="px-4 py-3 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="flex-1 flex items-center justify-center gap-2 bg-[#9147ff] hover:bg-[#7d2ff7] text-white font-semibold py-3 rounded-xl transition-colors"
        >
          That&apos;s my timezone
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function FinishStep({
  displayName,
  friendCount,
  timezone,
  submitting,
  submitError,
  onFinish,
  onBack,
}: {
  displayName: string;
  friendCount: number;
  timezone: string;
  submitting: boolean;
  submitError: string;
  onFinish: () => void;
  onBack: () => void;
}) {
  return (
    <div className="text-center space-y-8">
      <div className="space-y-3">
        <div className="w-16 h-16 rounded-full bg-[#9147ff]/15 border border-[#9147ff]/30 flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(145,71,255,0.2)]">
          <Check className="w-7 h-7 text-[#9147ff]" />
        </div>
        <h2 className="text-2xl font-bold text-white">You&apos;re all set, {displayName}.</h2>
        <p className="text-zinc-400 text-sm leading-relaxed">
          Home is ready. Start exploring your crew&apos;s schedule
          and create your first collab event.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-left">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-2xl font-bold text-white">{friendCount}</p>
          <p className="text-xs text-zinc-500 mt-0.5">Friends added</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-sm font-bold text-white truncate">{timezone.split("/").pop()?.replace(/_/g, " ") ?? timezone}</p>
          <p className="text-xs text-zinc-500 mt-0.5">Timezone set</p>
        </div>
      </div>

      {submitError && (
        <p className="text-sm text-red-400 text-center">{submitError}</p>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          disabled={submitting}
          className="px-4 py-3 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors disabled:opacity-40"
        >
          Back
        </button>
        <button
          onClick={onFinish}
          disabled={submitting}
          className="flex-1 flex items-center justify-center gap-2 bg-[#9147ff] hover:bg-[#7d2ff7] disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Open Home
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
