"use client";

import { useState, useEffect } from "react";
import { Loader2, X, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface OnboardingModalProps {
  displayName: string;
  avatarUrl: string;
  onComplete: () => void;
}

interface AddedFriend {
  username: string;
  displayName: string;
  avatarUrl: string;
}

const STEPS = 4;

export default function OnboardingModal({ displayName, avatarUrl, onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState(0);
  const [transitioning, setTransitioning] = useState(false);

  // Step 2 — friends
  const [friendInput, setFriendInput] = useState("");
  const [addedFriends, setAddedFriends] = useState<AddedFriend[]>([]);
  const [addingFriend, setAddingFriend] = useState(false);
  const [friendError, setFriendError] = useState("");

  // Step 3 — timezone
  const [timezone, setTimezone] = useState("UTC");
  const [timezones, setTimezones] = useState<string[]>([]);
  const [timezonesReady, setTimezonesReady] = useState(false);

  // Step 4 — submitting
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Only run client-side to avoid SSR issues
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const all = Intl.supportedValuesOf("timeZone");
    setTimezone(detected || "UTC");
    setTimezones(all);
    setTimezonesReady(true);
  }, []);

  function goToStep(next: number) {
    setTransitioning(true);
    setTimeout(() => {
      setStep(next);
      setTransitioning(false);
    }, 200);
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
      if (!res.ok) {
        setFriendError(data.error ?? "Could not add friend.");
      } else {
        setAddedFriends((prev) => [
          ...prev,
          {
            username: data.username,
            displayName: data.displayName,
            avatarUrl: data.avatarUrl ?? "",
          },
        ]);
        setFriendInput("");
      }
    } catch {
      setFriendError("Network error. Please try again.");
    } finally {
      setAddingFriend(false);
    }
  }

  function removeFriend(username: string) {
    setAddedFriends((prev) => prev.filter((f) => f.username !== username));
  }

  async function finish() {
    setSubmitting(true);
    try {
      await fetch("/api/profile/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone }),
      });
    } finally {
      setSubmitting(false);
      onComplete();
    }
  }

  const cardClass = `transition-all duration-200 ${
    transitioning ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"
  }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      {/* Animated fog blobs */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden="true"
      >
        <div
          style={{
            position: "absolute",
            top: "10%",
            left: "5%",
            width: "45vw",
            height: "45vw",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, hsl(221 83% 73% / 0.12) 0%, transparent 70%)",
            animation: "ob-float-1 14s ease-in-out infinite",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "10%",
            right: "5%",
            width: "38vw",
            height: "38vw",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, hsl(221 83% 73% / 0.09) 0%, transparent 70%)",
            animation: "ob-float-2 18s ease-in-out infinite",
          }}
        />
      </div>

      {/* Card */}
      <div
        className={`relative z-10 w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-8 ${cardClass}`}
      >
        {/* Step dots */}
        <div className="flex gap-1.5 mb-6">
          {Array.from({ length: STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === step
                  ? "bg-primary w-6"
                  : i < step
                  ? "bg-primary/50 w-3"
                  : "bg-border w-3"
              }`}
            />
          ))}
        </div>

        {step === 0 && <StepWelcome displayName={displayName} avatarUrl={avatarUrl} onNext={() => goToStep(1)} />}
        {step === 1 && (
          <StepFriends
            friendInput={friendInput}
            setFriendInput={setFriendInput}
            addedFriends={addedFriends}
            addingFriend={addingFriend}
            friendError={friendError}
            onAdd={addFriend}
            onRemove={removeFriend}
            onNext={() => goToStep(2)}
          />
        )}
        {step === 2 && (
          <StepTimezone
            timezone={timezone}
            setTimezone={setTimezone}
            timezones={timezones}
            timezonesReady={timezonesReady}
            onNext={() => goToStep(3)}
          />
        )}
        {step === 3 && (
          <StepDone
            addedFriends={addedFriends}
            timezone={timezone}
            submitting={submitting}
            onFinish={finish}
          />
        )}
      </div>
    </div>
  );
}

/* ── Step 1: Welcome ── */
function StepWelcome({
  displayName,
  avatarUrl,
  onNext,
}: {
  displayName: string;
  avatarUrl: string;
  onNext: () => void;
}) {
  const features = [
    { icon: "🎮", text: "Track your friends' schedules and go-live patterns" },
    { icon: "📅", text: "Plan and manage collab events on a shared calendar" },
    { icon: "🔗", text: "Share invite links that pre-fill event planning" },
  ];

  return (
    <div>
      <div
        className="flex items-center gap-3 mb-5"
        style={{ animation: "ob-fade-up 0.4s ease both", animationDelay: "0ms" }}
      >
        <Avatar className="h-10 w-10">
          <AvatarImage src={avatarUrl} />
          <AvatarFallback>{displayName[0]?.toUpperCase() ?? "?"}</AvatarFallback>
        </Avatar>
        <div>
          <h2 className="text-xl font-bold leading-tight">Welcome to Collab Planner</h2>
          <p className="text-sm text-muted-foreground">Hey, {displayName}!</p>
        </div>
      </div>

      <p
        className="text-muted-foreground text-sm mb-5"
        style={{ animation: "ob-fade-up 0.4s ease both", animationDelay: "80ms" }}
      >
        Plan better collabs with your Twitch friends.
      </p>

      <div className="space-y-3 mb-7">
        {features.map((f, i) => (
          <div
            key={i}
            className="flex items-start gap-3 text-sm"
            style={{
              animation: "ob-fade-up 0.4s ease both",
              animationDelay: `${200 + i * 80}ms`,
            }}
          >
            <span className="text-base">{f.icon}</span>
            <span className="text-foreground/80">{f.text}</span>
          </div>
        ))}
      </div>

      <Button
        className="w-full"
        onClick={onNext}
        style={{ animation: "ob-fade-up 0.4s ease both", animationDelay: "400ms" }}
      >
        Get Started →
      </Button>
    </div>
  );
}

/* ── Step 2: Add Friends ── */
function StepFriends({
  friendInput,
  setFriendInput,
  addedFriends,
  addingFriend,
  friendError,
  onAdd,
  onRemove,
  onNext,
}: {
  friendInput: string;
  setFriendInput: (v: string) => void;
  addedFriends: AddedFriend[];
  addingFriend: boolean;
  friendError: string;
  onAdd: () => void;
  onRemove: (username: string) => void;
  onNext: () => void;
}) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  useEffect(() => {
    // Fire-and-forget: populate suggestions
    fetch("/api/friends/sync-suggestions", { method: "POST" }).catch(() => {});

    // Fetch any existing suggestions
    fetch("/api/friends?suggested=true")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setSuggestions(data.filter((f: any) => !f.isMe).slice(0, 5));
      })
      .catch(() => {});
  }, []);

  async function confirmSuggestion(friend: any) {
    setConfirmingId(friend.id);
    try {
      await fetch(`/api/friends/${friend.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSuggested: false }),
      });
      setSuggestions((prev) => prev.filter((f) => f.id !== friend.id));
      if (!addedFriends.some((f) => f.username === friend.username)) {
        // addedFriends is managed in parent; just remove from suggestions view
      }
    } finally {
      setConfirmingId(null);
    }
  }

  return (
    <div>
      <h2
        className="text-xl font-bold mb-1"
        style={{ animation: "ob-fade-up 0.4s ease both", animationDelay: "0ms" }}
      >
        Add your Twitch friends
      </h2>
      <p
        className="text-sm text-muted-foreground mb-5"
        style={{ animation: "ob-fade-up 0.4s ease both", animationDelay: "80ms" }}
      >
        Search by username and add the streamers you collab with.
      </p>

      {suggestions.length > 0 && (
        <div
          className="mb-4 space-y-2"
          style={{ animation: "ob-fade-up 0.4s ease both", animationDelay: "120ms" }}
        >
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <Sparkles className="h-3 w-3" />
            <span>Suggested for you</span>
          </div>
          {suggestions.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-2 rounded-md border border-dashed bg-secondary/40 px-2.5 py-1.5"
            >
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarImage src={f.avatarUrl} />
                <AvatarFallback className="text-xs">{f.displayName[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{f.displayName}</p>
                <p className="text-[11px] text-muted-foreground truncate">@{f.username}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-xs shrink-0"
                disabled={confirmingId === f.id}
                onClick={() => confirmSuggestion(f)}
              >
                {confirmingId === f.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Check className="h-3 w-3 mr-1" />Add</>}
              </Button>
            </div>
          ))}
        </div>
      )}

      <div
        className="flex gap-2 mb-1"
        style={{ animation: "ob-fade-up 0.4s ease both", animationDelay: "200ms" }}
      >
        <Input
          placeholder="Search Twitch username…"
          value={friendInput}
          onChange={(e) => {
            setFriendInput(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") onAdd();
          }}
          disabled={addingFriend}
          className="flex-1"
        />
        <Button onClick={onAdd} disabled={addingFriend || !friendInput.trim()} size="sm">
          {addingFriend ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
        </Button>
      </div>

      {friendError && (
        <p className="text-xs text-destructive mb-3">{friendError}</p>
      )}

      {addedFriends.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5 mt-3">
          {addedFriends.map((f) => (
            <div
              key={f.username}
              className="flex items-center gap-1.5 bg-secondary rounded-full pl-1 pr-2 py-0.5 text-sm"
            >
              <Avatar className="h-5 w-5">
                <AvatarImage src={f.avatarUrl} />
                <AvatarFallback className="text-xs">{f.displayName[0]}</AvatarFallback>
              </Avatar>
              <span className="text-xs font-medium">{f.displayName}</span>
              <button
                onClick={() => onRemove(f.username)}
                className="text-muted-foreground hover:text-foreground transition-colors ml-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Button
        className="w-full mt-4"
        onClick={onNext}
        style={{ animation: "ob-fade-up 0.4s ease both", animationDelay: "400ms" }}
      >
        Continue →
      </Button>
    </div>
  );
}

/* ── Step 3: Timezone ── */
function StepTimezone({
  timezone,
  setTimezone,
  timezones,
  timezonesReady,
  onNext,
}: {
  timezone: string;
  setTimezone: (v: string) => void;
  timezones: string[];
  timezonesReady: boolean;
  onNext: () => void;
}) {
  return (
    <div>
      <h2
        className="text-xl font-bold mb-1"
        style={{ animation: "ob-fade-up 0.4s ease both", animationDelay: "0ms" }}
      >
        Set your timezone
      </h2>
      <p
        className="text-sm text-muted-foreground mb-5"
        style={{ animation: "ob-fade-up 0.4s ease both", animationDelay: "80ms" }}
      >
        Used to show stream times in your local time.
      </p>

      <div
        style={{ animation: "ob-fade-up 0.4s ease both", animationDelay: "200ms" }}
      >
        {timezonesReady ? (
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 mb-6"
          >
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        ) : (
          <div className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-muted-foreground mb-6">
            Loading timezones…
          </div>
        )}
      </div>

      <Button
        className="w-full"
        onClick={onNext}
        style={{ animation: "ob-fade-up 0.4s ease both", animationDelay: "400ms" }}
      >
        Almost done →
      </Button>
    </div>
  );
}

/* ── Step 4: Done ── */
function StepDone({
  addedFriends,
  timezone,
  submitting,
  onFinish,
}: {
  addedFriends: AddedFriend[];
  timezone: string;
  submitting: boolean;
  onFinish: () => void;
}) {
  return (
    <div>
      <div
        className="text-4xl mb-4"
        style={{ animation: "ob-fade-up 0.4s ease both", animationDelay: "0ms" }}
      >
        🎉
      </div>
      <h2
        className="text-xl font-bold mb-1"
        style={{ animation: "ob-fade-up 0.4s ease both", animationDelay: "80ms" }}
      >
        You&apos;re all set!
      </h2>

      <div
        className="space-y-2 my-5 text-sm text-muted-foreground"
        style={{ animation: "ob-fade-up 0.4s ease both", animationDelay: "200ms" }}
      >
        {addedFriends.length > 0 && (
          <p>
            ✅ Added{" "}
            <span className="text-foreground font-medium">
              {addedFriends.length} friend{addedFriends.length !== 1 ? "s" : ""}
            </span>{" "}
            — your dashboard will update with their stream data.
          </p>
        )}
        <p>
          🕐 Times will show in{" "}
          <span className="text-foreground font-medium">{timezone}</span>.
        </p>
      </div>

      <Button
        className="w-full"
        onClick={onFinish}
        disabled={submitting}
        style={{ animation: "ob-fade-up 0.4s ease both", animationDelay: "400ms" }}
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Open Dashboard →
      </Button>
    </div>
  );
}
