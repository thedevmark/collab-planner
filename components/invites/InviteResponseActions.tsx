"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InviteResponseActionsProps {
  token: string;
  isSignedIn: boolean;
  viewerUsername: string | null;
  initialStatus: string | null;
  initialClaimed: boolean;
}

export function InviteResponseActions({
  token,
  isSignedIn,
  viewerUsername,
  initialStatus,
  initialClaimed,
}: InviteResponseActionsProps) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [claimed, setClaimed] = useState(initialClaimed);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function runAction(action: "accept" | "decline" | "claim", redirectToPlanner = false) {
    setLoadingAction(action);
    setError("");

    try {
      const res = await fetch(`/api/invites/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Could not update invite.");
      }

      if (data.recipient?.status) {
        setStatus(data.recipient.status);
      }
      if (data.recipient?.claimedAt) {
        setClaimed(true);
      } else if (action === "claim") {
        setClaimed(true);
      }

      if (redirectToPlanner) {
        router.push(`/events/new?fromInvite=${token}`);
      }
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Could not update invite.");
    } finally {
      setLoadingAction(null);
    }
  }

  if (!isSignedIn) {
    return (
      <div className="space-y-3 rounded-2xl border border-border bg-background/60 p-4">
        <p className="text-sm text-muted-foreground">
          Sign in with Twitch to accept, decline, or claim this invite in the planner.
        </p>
        <Link href="/login" className="block">
          <Button className="w-full">Sign in to respond</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-background/60 p-4">
      <div>
        <p className="text-sm font-medium">
          Responding as {viewerUsername ? `@${viewerUsername}` : "your account"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Accept or decline here, or claim the invite and open it in the event planner.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Button
          variant={status === "accepted" ? "default" : "outline"}
          disabled={loadingAction !== null}
          onClick={() => runAction("accept")}
        >
          {loadingAction === "accept" ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
          {status === "accepted" ? "Accepted" : "Accept"}
        </Button>
        <Button
          variant={status === "declined" ? "destructive" : "outline"}
          disabled={loadingAction !== null}
          onClick={() => runAction("decline")}
        >
          {loadingAction === "decline" ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserX className="h-4 w-4" />}
          {status === "declined" ? "Declined" : "Decline"}
        </Button>
        <Button
          disabled={loadingAction !== null}
          onClick={() => runAction("claim", true)}
        >
          {loadingAction === "claim" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {claimed ? "Open planner" : "Claim & plan"}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
