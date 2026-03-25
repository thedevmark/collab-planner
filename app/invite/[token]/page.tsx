import { prisma } from "@/lib/db";
import { formatDistanceToNow, formatDistanceToNowStrict } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarClock, Clock, Link2Off, Users } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { getAuthUser } from "@/lib/auth";
import { InviteResponseActions } from "@/components/invites/InviteResponseActions";

interface Props {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const invite = await prisma.collabInvite.findUnique({ where: { token } });
  if (!invite) return { title: "Invite Not Found — Collab Planner" };
  return {
    title: `${invite.creatorDisplayName || "Someone"} invited you to collab`,
    description: invite.description || `Join ${invite.title} on Collab Planner`,
  };
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params;
  const [invite, user] = await Promise.all([
    prisma.collabInvite.findUnique({
      where: { token },
      include: {
        recipients: {
          orderBy: [{ status: "asc" }, { displayName: "asc" }],
        },
      },
    }),
    getAuthUser(),
  ]);

  if (!invite) {
    return (
      <CenteredShell>
        <ErrorState
          icon={<Link2Off className="h-10 w-10 text-muted-foreground" />}
          title="Invite not found"
          description="This invite link doesn't exist or has been removed."
        />
      </CenteredShell>
    );
  }

  const now = new Date();
  const expired = invite.expiresAt != null && invite.expiresAt < now;
  const exhausted = invite.maxUses != null && invite.usedCount >= invite.maxUses;

  if (expired) {
    return (
      <CenteredShell>
        <ErrorState
          icon={<Clock className="h-10 w-10 text-muted-foreground" />}
          title="This invite has expired"
          description={`This invite expired ${formatDistanceToNow(invite.expiresAt!, { addSuffix: true })}.`}
        />
      </CenteredShell>
    );
  }

  if (exhausted) {
    return (
      <CenteredShell>
        <ErrorState
          icon={<Users className="h-10 w-10 text-muted-foreground" />}
          title="This invite has reached its limit"
          description="The maximum number of uses for this invite has been reached."
        />
      </CenteredShell>
    );
  }

  const participants =
    invite.recipients.length > 0
      ? invite.recipients.map((recipient) => ({
          displayName: recipient.displayName,
          username: recipient.username,
          avatarUrl: recipient.avatarUrl,
          status: recipient.status,
          claimedAt: recipient.claimedAt,
        }))
      : invite.participantDisplayNames.map((name, i) => ({
          displayName: name,
          username: invite.participantUsernames[i] ?? "",
          avatarUrl: invite.participantAvatarUrls[i] ?? "",
          status: "pending",
          claimedAt: null,
        }));

  const viewerProfile = user
    ? await prisma.profile.findUnique({
        where: { id: user.id },
        select: { username: true },
      })
    : null;
  const viewerRecipient =
    viewerProfile != null
      ? participants.find(
          (participant) =>
            participant.username.toLowerCase() === viewerProfile.username.toLowerCase()
        ) ?? null
      : null;
  const acceptedCount = participants.filter((participant) => participant.status === "accepted").length;
  const declinedCount = participants.filter((participant) => participant.status === "declined").length;
  const claimedCount = participants.filter((participant) => participant.claimedAt != null).length;

  return (
    <CenteredShell>
      <Card className="w-full max-w-lg border-border bg-card shadow-xl">
        <CardContent className="p-8 space-y-6">
          {/* Creator row */}
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 ring-2 ring-border">
              <AvatarImage src={invite.creatorAvatarUrl} />
              <AvatarFallback className="text-sm">
                {(invite.creatorDisplayName || "?")[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {invite.creatorDisplayName || invite.creatorUsername || "Someone"}
                </span>{" "}
                invited you to collab
              </p>
            </div>
          </div>

          {/* Title + game */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">{invite.title}</h1>
            {invite.gameName && (
              <Badge variant="secondary" className="text-sm">
                🎮 {invite.gameName}
              </Badge>
            )}
            {participants.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge variant="secondary">{acceptedCount} accepted</Badge>
                <Badge variant="secondary">{declinedCount} declined</Badge>
                <Badge variant="secondary">{claimedCount} claimed</Badge>
              </div>
            )}
          </div>

          {/* Description */}
          {invite.description && (
            <p className="text-muted-foreground text-sm leading-relaxed">{invite.description}</p>
          )}

          {/* Personal message */}
          {invite.message && (
            <blockquote className="border-l-2 border-primary/40 pl-4 italic text-sm text-muted-foreground">
              "{invite.message}"
            </blockquote>
          )}

          {/* Participants */}
          {participants.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Participants
              </p>
              <div className="flex flex-wrap gap-2">
                {participants.map((p) => (
                  <div key={p.username} className="flex items-center gap-1.5">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={p.avatarUrl} />
                      <AvatarFallback className="text-xs">
                        {(p.displayName || p.username)[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{p.displayName || p.username}</span>
                    <Badge variant={recipientBadgeVariant(p.status, p.claimedAt != null)} className="text-[10px]">
                      {recipientBadgeLabel(p.status, p.claimedAt != null)}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expiry */}
          {invite.expiresAt && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" />
              <span>
                Expires{" "}
                {formatDistanceToNowStrict(invite.expiresAt, { addSuffix: true })}
              </span>
            </div>
          )}

          <InviteResponseActions
            token={token}
            isSignedIn={user != null}
            viewerUsername={viewerProfile?.username ?? null}
            initialStatus={viewerRecipient?.status ?? null}
            initialClaimed={viewerRecipient?.claimedAt != null}
          />
        </CardContent>
      </Card>
    </CenteredShell>
  );
}

function CenteredShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      {children}
    </div>
  );
}

function ErrorState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card className="w-full max-w-sm border-border bg-card shadow-xl">
      <CardContent className="p-8 flex flex-col items-center text-center gap-4">
        {icon}
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Link href="/login">
          <Button variant="outline" size="sm">
            Go to Collab Planner
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

function recipientBadgeVariant(status: string, claimed = false): "secondary" | "success" | "destructive" | "outline" {
  if (status === "accepted") return "success";
  if (status === "declined") return "destructive";
  if (claimed) return "outline";
  return "secondary";
}

function recipientBadgeLabel(status: string, claimed: boolean) {
  if (status === "accepted") return "Accepted";
  if (status === "declined") return "Declined";
  if (claimed) return "Claimed";
  return "Pending";
}
