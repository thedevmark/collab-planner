"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

/**
 * Stream Pattern Overlap visualization.
 *
 * Shown originally as a sidebar on /events/new and promoted here so it can
 * also be the entire content of the /plan/overlap route. For each selected
 * friend it renders:
 *   - avatar + channel-color label + median "typical streaming time"
 *   - a 7-day heatmap highlighting their top-3 stream days
 *   - cross-group overlap days (highlighted more strongly on everyone's row)
 *
 * Pass `sticky={false}` when using as main page content — the sticky default
 * is intended for sidebar usage.
 */

const FALLBACK_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
];

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const FULL_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function getFriendPattern(friend: any) {
  const history = friend.streamHistory ?? [];
  const segments = friend.scheduleSegments ?? [];
  const dayCounts: Record<number, number> = {};
  const hours: number[] = [];

  for (const s of history) {
    const d = new Date(s.startTime).getDay();
    dayCounts[d] = (dayCounts[d] ?? 0) + 1;
    hours.push(new Date(s.startTime).getHours());
  }
  for (const s of segments) {
    const d = new Date(s.startTime).getDay();
    dayCounts[d] = (dayCounts[d] ?? 0) + 0.5;
    hours.push(new Date(s.startTime).getHours());
  }

  if (hours.length === 0) return null;

  const topDayIndices = Object.entries(dayCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([d]) => parseInt(d));

  hours.sort((a, b) => a - b);
  const medHour = hours[Math.floor(hours.length / 2)];
  const h = medHour % 12 === 0 ? 12 : medHour % 12;
  const typicalTime = `~${h}${medHour >= 12 ? "PM" : "AM"}`;

  return { topDayIndices, typicalTime };
}

export interface StreamPatternPanelProps {
  selectedFriendIds: number[];
  allFriends: any[];
  /** Keep the card pinned while the outer column scrolls. Defaults true (sidebar mode). */
  sticky?: boolean;
}

export function StreamPatternPanel({
  selectedFriendIds,
  allFriends,
  sticky = true,
}: StreamPatternPanelProps) {
  const selected = allFriends.filter((f) => selectedFriendIds.includes(f.id));
  if (selected.length === 0) return null;

  const patterns = selected.map((f) => {
    const color = f.channelColor || FALLBACK_COLORS[
      allFriends.filter((x) => !x.isMe).findIndex((x) => x.id === f.id) % FALLBACK_COLORS.length
    ];
    return { friend: f, color, pattern: getFriendPattern(f) };
  });

  const patternsWithData = patterns.filter((p) => p.pattern);
  const overlapDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => {
    if (patternsWithData.length === 0) return false;
    const matches = patternsWithData.filter((p) => p.pattern!.topDayIndices.includes(d)).length;
    return matches >= Math.max(2, Math.ceil(patternsWithData.length * 0.6));
  });

  return (
    <Card className={sticky ? "sticky top-6" : undefined}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Stream Pattern Overlap
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {patterns.map(({ friend, color, pattern }) => (
          <div key={friend.id} className="space-y-1.5 animate-fade-in-up">
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={friend.avatarUrl} />
                <AvatarFallback className="text-[10px]">{friend.displayName[0]}</AvatarFallback>
              </Avatar>
              <span className="text-xs font-semibold truncate" style={{ color }}>
                {friend.isMe ? "You" : friend.displayName}
              </span>
              {pattern && (
                <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{pattern.typicalTime}</span>
              )}
            </div>

            {pattern ? (
              <div className="flex gap-0.5">
                {DAYS.map((d, i) => {
                  const active = pattern.topDayIndices.includes(i);
                  const overlap = overlapDays.includes(i);
                  return (
                    <span
                      key={d}
                      className="flex-1 text-center text-[10px] py-0.5 rounded font-medium"
                      style={
                        active
                          ? {
                              backgroundColor: overlap ? color : color + "55",
                              color: overlap ? "#fff" : color,
                              outline: overlap ? `1px solid ${color}` : "none",
                            }
                          : { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }
                      }
                    >
                      {d}
                    </span>
                  );
                })}
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground italic">Not enough data yet</p>
            )}
          </div>
        ))}

        {overlapDays.length > 0 && patterns.length > 1 && (
          <div className="pt-1 border-t border-border">
            <p className="text-[10px] text-muted-foreground mb-1">Best overlap days</p>
            <div className="flex gap-1 flex-wrap">
              {overlapDays.map((d) => (
                <Badge key={d} variant="secondary" className="text-[10px] px-2 py-0.5">
                  {FULL_DAYS[d]}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {patterns.length > 1 && overlapDays.length === 0 && patternsWithData.length > 1 && (
          <p className="text-[10px] text-muted-foreground italic pt-1 border-t border-border">
            No consistent overlap — try Suggest Times for the best fit.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
