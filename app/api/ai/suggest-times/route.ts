import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateText } from "@/lib/gemini/client";
import { buildTimeSuggestionPrompt } from "@/lib/gemini/prompts";
import { analyzePatterns } from "@/lib/scheduling/patterns";
import { findOverlapWindows, scheduleSegmentsToSlots } from "@/lib/scheduling/overlap";
import { z } from "zod";
import type { TimeSuggestion } from "@/types";

const schema = z.object({
  friendIds: z.array(z.number()).min(1),
  userTimezone: z.string().default("UTC"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { friendIds, userTimezone } = schema.parse(body);

    const friends = await prisma.friend.findMany({
      where: { id: { in: friendIds } },
      include: {
        streamHistory: {
          orderBy: { startTime: "desc" },
          take: 30,
        },
        scheduleSegments: {
          where: { startTime: { gte: new Date() } },
          orderBy: { startTime: "asc" },
        },
      },
    });

    // Build pattern analysis — history is primary, schedule refines it
    const friendPatterns = friends.map((f) =>
      analyzePatterns(
        f.id,
        f.displayName,
        f.streamHistory.map((h) => ({
          startTime: h.startTime,
          endTime: h.endTime,
          gameName: h.gameName,
          durationSec: h.durationSec,
        })),
        f.scheduleSegments.map((s) => ({
          startTime: s.startTime,
          endTime: s.endTime,
          gameName: s.gameName,
          isRecurring: s.isRecurring,
        }))
      )
    );

    // Build candidate overlap windows from inferred future windows (from patterns)
    // + any actual schedule segments if they exist
    const allSlots = [
      // Inferred windows from history patterns
      ...friendPatterns.flatMap((p) =>
        p.inferredWindows.map((w) => ({
          start: w.start,
          end: w.end,
          participantId: String(p.friendId),
          participantName: p.displayName,
        }))
      ),
      // Actual schedule segments if available (bonus)
      ...friends.flatMap((f) =>
        scheduleSegmentsToSlots(
          f.scheduleSegments.map((s) => ({
            startTime: s.startTime,
            endTime: s.endTime,
            participantId: String(f.id),
            participantName: f.displayName,
          }))
        )
      ),
    ];

    const overlapWindows = findOverlapWindows(allSlots, 2);

    const prompt = buildTimeSuggestionPrompt({
      userTimezone,
      friendPatterns: friendPatterns.map((p) => ({
        name: p.displayName,
        summary: p.summary,
        typicalDays: p.typicalDays,
        topGames: p.topGames,
        avgDurationHours: p.avgDurationHours,
      })),
      windows: overlapWindows.slice(0, 15).map((w) => ({
        start: w.start.toISOString(),
        end: w.end.toISOString(),
        participants: w.participants,
      })),
    });

    const text = await generateText(prompt);
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "AI returned invalid response" }, { status: 500 });
    }

    const suggestions: TimeSuggestion[] = JSON.parse(jsonMatch[0]);
    return NextResponse.json({
      suggestions,
      basedOn: friendPatterns.map((p) => ({ name: p.displayName, streams: p.summary })),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }
    return NextResponse.json(
      { error: `Failed to suggest times: ${err instanceof Error ? err.message : "Unknown"}` },
      { status: 500 }
    );
  }
}
