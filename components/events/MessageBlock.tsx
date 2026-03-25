"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Copy, MessageSquare } from "lucide-react";
import { format } from "date-fns";

interface MessageBlockProps {
  title: string;
  gameName?: string;
  startTime: Date;
  endTime: Date;
  participants: Array<{ displayName: string; twitchUsername?: string }>;
  /** User's saved timezone string (e.g. "America/New_York") */
  timezone?: string;
}

function formatInTimezone(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(date);
  } catch {
    return format(date, "EEEE, MMMM d, yyyy");
  }
}

function formatTimeInTimezone(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
      hour12: true,
    }).format(date);
  } catch {
    return format(date, "h:mm a");
  }
}

function getDurationLabel(startTime: Date, endTime: Date): string {
  const diffMs = endTime.getTime() - startTime.getTime();
  const hours = diffMs / 3600000;
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours % 1 === 0) return `${hours}h`;
  return `~${Math.round(hours)}h`;
}

export function MessageBlock({
  title,
  gameName,
  startTime,
  endTime,
  participants,
  timezone = "UTC",
}: MessageBlockProps) {
  const [copied, setCopied] = useState(false);

  const dateStr = formatInTimezone(startTime, timezone);
  const timeStr = formatTimeInTimezone(startTime, timezone);
  const duration = getDurationLabel(startTime, endTime);
  const names = participants.map((p) => `@${p.twitchUsername ?? p.displayName}`).join(", ");

  const block = [
    `🎮 ${gameName ? `Game: ${gameName}` : title}`,
    `📅 ${dateStr}`,
    `🕐 ${timeStr} (~${duration})`,
    names ? `👥 Playing with: ${names}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  async function copyBlock() {
    await navigator.clipboard.writeText(block);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Share on Discord
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <pre className="text-sm bg-muted p-3 rounded-md whitespace-pre-wrap font-sans leading-relaxed select-all">
          {block}
        </pre>
        <p className="text-xs text-muted-foreground">
          Copy these facts — then write your own message around them.
        </p>
        <Button size="sm" onClick={copyBlock} variant="outline" className="gap-2">
          {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied!" : "Copy facts"}
        </Button>
      </CardContent>
    </Card>
  );
}
