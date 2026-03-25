"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarPlus,
  Check,
  CheckCircle2,
  Clock3,
  Globe2,
  Loader2,
  MessageSquare,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
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

type SetupFocus = "tracking" | "planning" | "sharing";

const STEPS = [
  {
    title: "Welcome",
    description: "See what the app will set up for you.",
  },
  {
    title: "Your goal",
    description: "Tell us what you want the app to help with first.",
  },
  {
    title: "Add friends",
    description: "Pull in the creators you stream with.",
  },
  {
    title: "Timezone",
    description: "Show schedules in the right local time.",
  },
  {
    title: "Finish",
    description: "Review the setup and jump into the app.",
  },
] as const;

const FOCUS_OPTIONS: Array<{
  id: SetupFocus;
  title: string;
  description: string;
  icon: typeof Users;
}> = [
  {
    id: "tracking",
    title: "Track who is live",
    description: "Keep an eye on upcoming streams, patterns, and collab signals.",
    icon: Users,
  },
  {
    id: "planning",
    title: "Schedule collabs faster",
    description: "Use friend data and the calendar to lock in better times quickly.",
    icon: CalendarPlus,
  },
  {
    id: "sharing",
    title: "Send cleaner invites",
    description: "Use generated messages and invite links when you are ready to book.",
    icon: MessageSquare,
  },
];

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

export default function OnboardingModal({
  displayName,
  avatarUrl,
  friendCount = 0,
  onComplete,
}: OnboardingModalProps) {
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [focus, setFocus] = useState<SetupFocus>("planning");

  const [friendInput, setFriendInput] = useState("");
  const [addingFriend, setAddingFriend] = useState(false);
  const [friendError, setFriendError] = useState("");
  const [addedFriends, setAddedFriends] = useState<SessionFriend[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestedFriend[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  const [timezone, setTimezone] = useState("UTC");
  const [timezones, setTimezones] = useState<string[]>(FALLBACK_TIMEZONES);
  const [timezonesReady, setTimezonesReady] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const manualAddedCount = addedFriends.filter((friend) => friend.source === "manual").length;
  const confirmedSuggestionCount = addedFriends.filter((friend) => friend.source === "suggested").length;
  const totalFriendsTracked = friendCount + manualAddedCount;

  useEffect(() => {
    const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const supportedTimezones =
      typeof Intl.supportedValuesOf === "function"
        ? Intl.supportedValuesOf("timeZone")
        : FALLBACK_TIMEZONES;

    setTimezone(detectedTimezone);
    setTimezones(Array.from(new Set([detectedTimezone, ...supportedTimezones])));
    setTimezonesReady(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSuggestions() {
      setLoadingSuggestions(true);

      try {
        await fetch("/api/friends/sync-suggestions", { method: "POST" }).catch(() => undefined);
        const res = await fetch("/api/friends?suggested=true");
        if (!res.ok) return;

        const data = await res.json();
        if (!cancelled && Array.isArray(data)) {
          setSuggestions(
            data
              .filter((friend: { isMe?: boolean }) => !friend.isMe)
              .slice(0, 6)
              .map((friend: SuggestedFriend) => ({
                id: friend.id,
                username: friend.username,
                displayName: friend.displayName,
                avatarUrl: friend.avatarUrl ?? "",
              }))
          );
        }
      } finally {
        if (!cancelled) setLoadingSuggestions(false);
      }
    }

    loadSuggestions();
    return () => {
      cancelled = true;
    };
  }, []);

  function queueTransition(nextStep: number) {
    setTransitioning(true);
    window.setTimeout(() => {
      setStep(nextStep);
      setTransitioning(false);
    }, 180);
  }

  function pushSessionFriend(friend: SessionFriend) {
    setAddedFriends((current) => {
      const exists = current.some(
        (entry) => entry.username.toLowerCase() === friend.username.toLowerCase()
      );
      return exists ? current : [...current, friend];
    });
  }

  async function addFriend() {
    const username = friendInput.trim();
    if (!username) return;

    const alreadyAdded = addedFriends.some(
      (friend) => friend.username.toLowerCase() === username.toLowerCase()
    );
    if (alreadyAdded) {
      setFriendError("That creator is already part of this setup.");
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
        setFriendError(data.error ?? "Could not add that Twitch user.");
        return;
      }

      pushSessionFriend({
        id: data.id,
        username: data.username,
        displayName: data.displayName,
        avatarUrl: data.avatarUrl ?? "",
        source: "manual",
      });
      setFriendInput("");
    } catch {
      setFriendError("Network error. Try again in a moment.");
    } finally {
      setAddingFriend(false);
    }
  }

  async function confirmSuggestion(friend: SuggestedFriend) {
    setConfirmingId(friend.id);
    setFriendError("");

    try {
      const res = await fetch(`/api/friends/${friend.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSuggested: false }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setFriendError(data?.error ?? "Could not confirm that suggestion.");
        return;
      }

      pushSessionFriend({
        id: friend.id,
        username: friend.username,
        displayName: friend.displayName,
        avatarUrl: friend.avatarUrl,
        source: "suggested",
      });
      setSuggestions((current) => current.filter((entry) => entry.id !== friend.id));
    } catch {
      setFriendError("Network error. Try again in a moment.");
    } finally {
      setConfirmingId(null);
    }
  }

  async function finish(destination: "dashboard" | "events") {
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
        throw new Error(data?.error ?? "Could not complete onboarding.");
      }

      await Promise.resolve(onComplete());

      if (destination === "events") {
        router.push("/events/new");
        return;
      }

      router.push("/");
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Could not complete onboarding."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const sessionLogins = new Set(
    addedFriends.map((friend) => friend.username.toLowerCase())
  );
  const visibleSuggestions = suggestions.filter(
    (friend) => !sessionLogins.has(friend.username.toLowerCase())
  );
  const cardClass = cn(
    "transition-all duration-200",
    transitioning ? "translate-y-3 opacity-0" : "translate-y-0 opacity-100"
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute left-[-10%] top-[-6%] h-[26rem] w-[26rem] rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute bottom-[-12%] right-[-8%] h-[30rem] w-[30rem] rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_42%)]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col gap-8 px-4 py-4 lg:flex-row lg:px-8 lg:py-8">
        <aside className="flex w-full flex-col rounded-[28px] border border-border/60 bg-card/70 p-6 shadow-2xl backdrop-blur xl:max-w-sm">
          <div className="mb-8 flex items-center gap-3">
            <Avatar className="h-11 w-11 border border-border/70">
              <AvatarImage src={avatarUrl} />
              <AvatarFallback>{displayName[0]?.toUpperCase() ?? "?"}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm text-muted-foreground">First run setup</p>
              <h2 className="text-xl font-semibold">Welcome, {displayName || "streamer"}</h2>
            </div>
          </div>

          <div className="mb-6 rounded-2xl border border-border/60 bg-background/70 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-primary" />
              Setup progress
            </div>
            <div className="space-y-3">
              {STEPS.map((item, index) => {
                const isActive = index === step;
                const isComplete = index < step;
                return (
                  <div key={item.title} className="flex items-start gap-3">
                    <div
                      className={cn(
                        "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                        isComplete && "border-primary bg-primary text-primary-foreground",
                        isActive && "border-primary/70 bg-primary/15 text-primary",
                        !isActive && !isComplete && "border-border text-muted-foreground"
                      )}
                    >
                      {isComplete ? <Check className="h-3.5 w-3.5" /> : index + 1}
                    </div>
                    <div>
                      <p className={cn("text-sm font-medium", isActive ? "text-foreground" : "text-muted-foreground")}>
                        {item.title}
                      </p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-left">
            <InfoStat label="Tracked" value={String(totalFriendsTracked)} />
            <InfoStat label="Saved" value={String(confirmedSuggestionCount)} />
            <InfoStat label="TZ" value={shortTimezoneLabel(timezone)} />
          </div>

          <Separator className="my-6" />

          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium">What this setup unlocks</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Better schedule predictions, faster collab planning, and cleaner invite follow-up.
              </p>
            </div>

            <div className="space-y-3 text-sm text-muted-foreground">
              <FeatureRow
                icon={Users}
                title="Friend intelligence"
                description="See schedules, stream history, and likely live windows in one place."
              />
              <FeatureRow
                icon={CalendarPlus}
                title="Faster planning"
                description="Use the calendar and event builder as soon as you leave onboarding."
              />
              <FeatureRow
                icon={MessageSquare}
                title="Outreach tools"
                description="Generate messages and share invite links when the time is right."
              />
            </div>
          </div>
        </aside>

        <main className="flex flex-1">
          <div className="flex w-full flex-col rounded-[32px] border border-border/60 bg-card/85 p-6 shadow-2xl backdrop-blur md:p-8">
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <Badge variant="secondary" className="mb-3 border border-border/70 bg-background/70 text-foreground">
                  Step {step + 1} of {STEPS.length}
                </Badge>
                <h1 className="text-3xl font-semibold tracking-tight">{STEPS[step].title}</h1>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  {STEPS[step].description}
                </p>
              </div>
              {step < STEPS.length - 1 && (
                <div className="text-right text-sm text-muted-foreground">
                  <p>About 2 minutes</p>
                  <p className="mt-1">Nothing here is permanent except your timezone.</p>
                </div>
              )}
            </div>

            <div className={cn("flex-1", cardClass)}>
              {step === 0 && <WelcomeStep displayName={displayName} avatarUrl={avatarUrl} />}
              {step === 1 && <FocusStep focus={focus} onSelect={setFocus} />}
              {step === 2 && (
                <FriendsStep
                  friendInput={friendInput}
                  setFriendInput={setFriendInput}
                  addingFriend={addingFriend}
                  friendError={friendError}
                  loadingSuggestions={loadingSuggestions}
                  visibleSuggestions={visibleSuggestions}
                  confirmingId={confirmingId}
                  addedFriends={addedFriends}
                  friendCount={friendCount}
                  totalFriendsTracked={totalFriendsTracked}
                  onAdd={addFriend}
                  onConfirmSuggestion={confirmSuggestion}
                />
              )}
              {step === 3 && (
                <TimezoneStep
                  timezone={timezone}
                  setTimezone={setTimezone}
                  timezones={timezones}
                  timezonesReady={timezonesReady}
                />
              )}
              {step === 4 && (
                <FinishStep
                  focus={focus}
                  timezone={timezone}
                  totalFriendsTracked={totalFriendsTracked}
                  confirmedSuggestionCount={confirmedSuggestionCount}
                  manualAddedCount={manualAddedCount}
                  submitError={submitError}
                  submitting={submitting}
                  onOpenDashboard={() => finish("dashboard")}
                  onPlanCollab={() => finish("events")}
                />
              )}
            </div>

            {step < STEPS.length - 1 && (
              <>
                <Separator className="my-6" />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-muted-foreground">
                    {step === 2
                      ? "You can add more friends later from the Friends page."
                      : step === 3
                      ? `Auto-detected timezone: ${friendlyTimezoneLabel(timezone)}`
                      : "You can still change these choices after setup."}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    {step > 0 && (
                      <Button variant="outline" onClick={() => queueTransition(step - 1)}>
                        <ArrowLeft className="h-4 w-4" />
                        Back
                      </Button>
                    )}
                    {step === 2 && (
                      <Button variant="ghost" onClick={() => queueTransition(step + 1)}>
                        Skip for now
                      </Button>
                    )}
                    <Button onClick={() => queueTransition(step + 1)}>
                      {step === 0
                        ? "Start setup"
                        : step === 1
                        ? "Continue"
                        : step === 2
                        ? "Keep going"
                        : "Review setup"}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function WelcomeStep({
  displayName,
  avatarUrl,
}: {
  displayName: string;
  avatarUrl: string;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
      <div className="rounded-[28px] border border-border/60 bg-background/75 p-6">
        <Badge variant="outline" className="mb-4 border-primary/30 bg-primary/10 text-primary">
          Streamer setup
        </Badge>
        <h2 className="max-w-xl text-4xl font-semibold leading-tight tracking-tight">
          Turn Twitch friend data into an actual collab workflow.
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
          This flow gets your account ready to track friends, read schedules in your own timezone,
          and move into planning without having to poke around the dashboard first.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <HighlightCard
            icon={Users}
            title="Track your circle"
            description="Add streamers you work with so the app can surface live windows and history."
          />
          <HighlightCard
            icon={Clock3}
            title="Fix time confusion"
            description="Normalize schedules into your timezone before you start comparing availability."
          />
          <HighlightCard
            icon={CalendarPlus}
            title="Plan right away"
            description="Finish setup and jump straight into your first event draft if you want to."
          />
        </div>
      </div>

      <div className="rounded-[28px] border border-border/60 bg-gradient-to-br from-primary/18 via-background/90 to-background p-6">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border border-border/60 shadow-lg">
            <AvatarImage src={avatarUrl} />
            <AvatarFallback>{displayName[0]?.toUpperCase() ?? "?"}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm text-muted-foreground">Signed in as</p>
            <h3 className="text-2xl font-semibold">{displayName || "Twitch user"}</h3>
          </div>
        </div>

        <div className="mt-8 space-y-4">
          <JourneyPoint
            number="01"
            title="Connect your setup"
            description="Pick your goal, confirm your timezone, and decide who belongs in your friend list."
          />
          <JourneyPoint
            number="02"
            title="Seed your graph"
            description="Manual adds work immediately, and suggested friends can be claimed in one click."
          />
          <JourneyPoint
            number="03"
            title="Use the app with context"
            description="Once this finishes, the dashboard and planning tools start with useful data."
          />
        </div>
      </div>
    </div>
  );
}

function FocusStep({
  focus,
  onSelect,
}: {
  focus: SetupFocus;
  onSelect: (focus: SetupFocus) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {FOCUS_OPTIONS.map((option) => {
        const Icon = option.icon;
        const selected = option.id === focus;

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(option.id)}
            className={cn(
              "rounded-[24px] border p-5 text-left transition-all",
              selected
                ? "border-primary bg-primary/12 shadow-[0_18px_50px_-24px_rgba(96,165,250,0.55)]"
                : "border-border/60 bg-background/70 hover:border-primary/40 hover:bg-background"
            )}
          >
            <div
              className={cn(
                "mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border",
                selected
                  ? "border-primary/30 bg-primary/12 text-primary"
                  : "border-border bg-card text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">{option.title}</h3>
              {selected && <CheckCircle2 className="h-5 w-5 text-primary" />}
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{option.description}</p>
          </button>
        );
      })}
    </div>
  );
}

function FriendsStep({
  friendInput,
  setFriendInput,
  addingFriend,
  friendError,
  loadingSuggestions,
  visibleSuggestions,
  confirmingId,
  addedFriends,
  friendCount,
  totalFriendsTracked,
  onAdd,
  onConfirmSuggestion,
}: {
  friendInput: string;
  setFriendInput: (value: string) => void;
  addingFriend: boolean;
  friendError: string;
  loadingSuggestions: boolean;
  visibleSuggestions: SuggestedFriend[];
  confirmingId: number | null;
  addedFriends: SessionFriend[];
  friendCount: number;
  totalFriendsTracked: number;
  onAdd: () => void;
  onConfirmSuggestion: (friend: SuggestedFriend) => void;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-[28px] border border-border/60 bg-card/70 p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <Badge variant="outline" className="mb-3 border-primary/30 bg-primary/10 text-primary">
              Start here
            </Badge>
            <h3 className="text-xl font-semibold">Suggested creators first</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Confirm the likely collab partners we already found, then search manually if anyone is missing.
            </p>
          </div>
          <Badge variant="secondary" className="border border-border/60 bg-background/70 px-3 py-1">
            {totalFriendsTracked} tracked
          </Badge>
        </div>

        <div className="mb-5 grid gap-4 md:grid-cols-2">
          <StatTile
            label="Already in your account"
            value={String(friendCount)}
            detail="Existing friends from earlier setup or imports."
          />
          <StatTile
            label="Added this session"
            value={String(addedFriends.length)}
            detail="Manual adds and confirmed suggestions from this onboarding run."
          />
        </div>

        <div className="mb-4">
          <h3 className="text-xl font-semibold">Suggested creators</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            These came from the Twitch-side suggestion sync and can be confirmed with one click.
          </p>
        </div>

        {loadingSuggestions ? (
          <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/60 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Looking for likely collab partners...
          </div>
        ) : visibleSuggestions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-background/60 p-5 text-sm text-muted-foreground">
            No suggestions are ready right now. Manual add still works immediately.
          </div>
        ) : (
          <div className="space-y-3">
            {visibleSuggestions.map((friend) => (
              <div
                key={friend.id}
                className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/60 p-3"
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={friend.avatarUrl} />
                  <AvatarFallback>{friend.displayName[0]?.toUpperCase() ?? "?"}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{friend.displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">@{friend.username}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={confirmingId === friend.id}
                  onClick={() => onConfirmSuggestion(friend)}
                >
                  {confirmingId === friend.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Save
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}

        <Separator className="my-6" />

        <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
          <p className="text-sm font-medium">Recommended minimum</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Track at least 3 creators to make the dashboard and planning suggestions noticeably more useful.
          </p>
        </div>
      </div>

      <div className="rounded-[28px] border border-border/60 bg-background/75 p-6">
        <div className="mb-5">
          <h2 className="text-2xl font-semibold">Search for missing creators</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            If the suggestion list missed someone, add their Twitch username here and they will start syncing immediately.
          </p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/80 p-4">
          <label className="mb-2 block text-sm font-medium">Search by Twitch username</label>
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={friendInput}
                onChange={(event) => setFriendInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") onAdd();
                }}
                placeholder="example_creator"
                className="pl-9"
                disabled={addingFriend}
              />
            </div>
            <Button onClick={onAdd} disabled={addingFriend || !friendInput.trim()}>
              {addingFriend ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Add friend
            </Button>
          </div>
          {friendError && <p className="mt-3 text-sm text-destructive">{friendError}</p>}
        </div>

        <div className="mt-6">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-medium">Added in this setup</h3>
          </div>
          {addedFriends.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-card/50 p-5 text-sm text-muted-foreground">
              No creators added in this session yet. You can continue without this and come back later.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {addedFriends.map((friend) => (
                <div
                  key={`${friend.source}-${friend.username}`}
                  className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/70 p-3"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={friend.avatarUrl} />
                    <AvatarFallback>{friend.displayName[0]?.toUpperCase() ?? "?"}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{friend.displayName}</p>
                    <p className="truncate text-xs text-muted-foreground">@{friend.username}</p>
                  </div>
                  <Badge variant="outline" className="border-border/70 bg-background/80">
                    {friend.source === "manual" ? "Manual" : "Suggested"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TimezoneStep({
  timezone,
  setTimezone,
  timezones,
  timezonesReady,
}: {
  timezone: string;
  setTimezone: (timezone: string) => void;
  timezones: string[];
  timezonesReady: boolean;
}) {
  const previewTime = formatCurrentTime(timezone);

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-[28px] border border-border/60 bg-background/75 p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary/12 text-primary">
            <Globe2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Confirm your timezone</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Event suggestions, stream windows, and generated messages will use this timezone.
            </p>
          </div>
        </div>

        <label className="mb-2 block text-sm font-medium">Timezone</label>
        {timezonesReady ? (
          <select
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {friendlyTimezoneLabel(tz)}
              </option>
            ))}
          </select>
        ) : (
          <div className="flex h-11 items-center rounded-xl border border-input bg-background px-3 text-sm text-muted-foreground">
            Loading timezones...
          </div>
        )}

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <StatTile
            label="Detected timezone"
            value={shortTimezoneLabel(timezone)}
            detail={friendlyTimezoneLabel(timezone)}
          />
          <StatTile
            label="Current local time"
            value={previewTime}
            detail="Quick preview using the timezone above."
          />
        </div>
      </div>

      <div className="rounded-[28px] border border-border/60 bg-card/70 p-6">
        <h3 className="text-xl font-semibold">Why this matters</h3>
        <div className="mt-5 space-y-4 text-sm text-muted-foreground">
          <FeatureRow
            icon={Clock3}
            title="Cleaner schedule reading"
            description="Stream windows line up with your day instead of forcing UTC math."
          />
          <FeatureRow
            icon={CalendarPlus}
            title="Better event planning"
            description="Suggested times and event cards use the same local reference point."
          />
          <FeatureRow
            icon={MessageSquare}
            title="More accurate messages"
            description="Generated outreach can include event times that already make sense to you."
          />
        </div>
      </div>
    </div>
  );
}

function FinishStep({
  focus,
  timezone,
  totalFriendsTracked,
  confirmedSuggestionCount,
  manualAddedCount,
  submitError,
  submitting,
  onOpenDashboard,
  onPlanCollab,
}: {
  focus: SetupFocus;
  timezone: string;
  totalFriendsTracked: number;
  confirmedSuggestionCount: number;
  manualAddedCount: number;
  submitError: string;
  submitting: boolean;
  onOpenDashboard: () => void;
  onPlanCollab: () => void;
}) {
  const selectedFocus = FOCUS_OPTIONS.find((option) => option.id === focus);

  return (
    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <div className="rounded-[28px] border border-border/60 bg-background/75 p-6">
        <Badge variant="outline" className="mb-4 border-primary/30 bg-primary/10 text-primary">
          Ready to go
        </Badge>
        <h2 className="text-3xl font-semibold tracking-tight">Your workspace is set.</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          You can open the dashboard with a cleaner starting point, or go straight into building
          the first collab event.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <StatTile
            label="Primary goal"
            value={selectedFocus?.title ?? "Schedule collabs faster"}
            detail={selectedFocus?.description ?? ""}
          />
          <StatTile
            label="Timezone"
            value={shortTimezoneLabel(timezone)}
            detail={friendlyTimezoneLabel(timezone)}
          />
          <StatTile
            label="Friends tracked"
            value={String(totalFriendsTracked)}
            detail="Current count after this onboarding run."
          />
          <StatTile
            label="Session actions"
            value={String(manualAddedCount + confirmedSuggestionCount)}
            detail={`${manualAddedCount} manual adds, ${confirmedSuggestionCount} suggestion saves.`}
          />
        </div>
      </div>

      <div className="rounded-[28px] border border-border/60 bg-card/75 p-6">
        <h3 className="text-xl font-semibold">What to do next</h3>
        <div className="mt-5 space-y-4">
          <ActionPanel
            title="Open dashboard"
            description="Start with live status, upcoming events, and likely stream windows."
            cta="Enter dashboard"
            disabled={submitting}
            loading={submitting}
            onClick={onOpenDashboard}
          />
          <ActionPanel
            title="Plan your first collab"
            description="Jump directly into the event builder with the setup already saved."
            cta="Create event"
            disabled={submitting}
            loading={false}
            onClick={onPlanCollab}
          />
        </div>

        {submitError && <p className="mt-4 text-sm text-destructive">{submitError}</p>}
      </div>
    </div>
  );
}

function HighlightCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Users;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

function JourneyPoint({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/85 text-sm font-semibold">
        {number}
      </div>
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function FeatureRow({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Users;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background/70 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-3 text-lg font-semibold">{value}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
    </div>
  );
}

function ActionPanel({
  title,
  description,
  cta,
  disabled,
  loading,
  onClick,
}: {
  title: string;
  description: string;
  cta: string;
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/65 p-4">
      <h4 className="text-base font-semibold">{title}</h4>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      <Button className="mt-4 w-full" disabled={disabled} onClick={onClick}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {cta}
      </Button>
    </div>
  );
}

function InfoStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}

function friendlyTimezoneLabel(value: string) {
  return value.replace(/_/g, " ");
}

function shortTimezoneLabel(value: string) {
  const parts = value.split("/");
  return parts[parts.length - 1]?.replace(/_/g, " ") || value;
}

function formatCurrentTime(timezone: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date());
  } catch {
    return "Unavailable";
  }
}
