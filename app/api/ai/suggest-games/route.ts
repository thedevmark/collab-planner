import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateText } from "@/lib/gemini/client";
import { buildGameSuggestionPrompt } from "@/lib/gemini/prompts";
import { analyzePatterns } from "@/lib/scheduling/patterns";
import { getTopGames } from "@/lib/twitch/client";
import { z } from "zod";
import type { GameSuggestion } from "@/types";

const schema = z.object({ friendIds: z.array(z.number()).min(1) });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { friendIds } = schema.parse(body);

    const friends = await prisma.friend.findMany({
      where: { id: { in: friendIds } },
      include: {
        streamHistory: { orderBy: { startTime: "desc" }, take: 30 },
        scheduleSegments: { orderBy: { startTime: "asc" }, take: 10 },
      },
    });

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

    // All games played across all friends (from real history)
    const recentGames = [
      ...new Set(friends.flatMap((f) => f.streamHistory.map((h) => h.gameName).filter(Boolean))),
    ];

    let trendingGames: string[] = [];
    try {
      const top = await getTopGames(10);
      trendingGames = top.map((g) => g.name);
    } catch {
      // Continue without trending
    }

    const prompt = buildGameSuggestionPrompt({
      friends: friends.map((f) => f.displayName),
      recentGames,
      trendingGames,
      friendPatterns: friendPatterns.map((p) => ({
        name: p.displayName,
        summary: p.summary,
        typicalDays: p.typicalDays,
        topGames: p.topGames,
        avgDurationHours: p.avgDurationHours,
      })),
    });

    const text = await generateText(prompt);
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "AI returned invalid response" }, { status: 500 });
    }

    const suggestions: GameSuggestion[] = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ suggestions });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }
    return NextResponse.json(
      { error: `Failed to suggest games: ${err instanceof Error ? err.message : "Unknown"}` },
      { status: 500 }
    );
  }
}
