export interface TimeWindow {
  start: string;
  end: string;
  participants: string[];
}

export interface FriendPattern {
  name: string;
  summary: string;        // human-readable history summary
  typicalDays: string[];
  topGames: string[];
  avgDurationHours: number;
}

export interface TimeSuggestionInput {
  userTimezone: string;
  windows: TimeWindow[];
  friendPatterns: FriendPattern[];
  collabContext?: string; // optional: detected collab history across all friends
}

export interface GameSuggestionInput {
  friends: string[];
  recentGames: string[];   // from stream history
  trendingGames: string[];
  friendPatterns: FriendPattern[];
}

export interface MessageInput {
  messageType: "invite" | "reminder";
  eventTitle: string;
  startTime: string;
  gameName: string;
  friends: string[];
  additionalContext?: string;
}

export function buildTimeSuggestionPrompt(input: TimeSuggestionInput): string {
  const patternBlock = input.friendPatterns
    .map((p) => `- ${p.summary}`)
    .join("\n");

  const windowBlock = input.windows.length > 0
    ? input.windows
        .map((w, i) => `${i + 1}. ${w.start} – ${w.end} (${w.participants.join(", ")} likely available based on history)`)
        .join("\n")
    : "No confirmed overlapping schedule segments found — use the historical patterns above to infer the best windows.";

  const collabBlock = input.collabContext
    ? `\n## Collaboration History (detected from VOD titles & concurrent streams)\n${input.collabContext}\n`
    : "";

  return `You are a scheduling assistant for a Twitch streamer planning collab streams.

## Streamer Patterns (from actual past broadcast history)
${patternBlock}
${collabBlock}
## Candidate Time Windows (inferred from history overlap)
${windowBlock}

Based on the historical streaming patterns and any previous collab history above, suggest the TOP 3 best times for a collab stream in the next 14 days. If these streamers have collaborated before, note it in the reasoning.

Return a JSON array with exactly 3 objects:
[
  {
    "rank": 1,
    "start": "<ISO datetime>",
    "end": "<ISO datetime>",
    "participants": ["name1", "name2"],
    "reason": "1-2 sentences explaining why based on their actual streaming history"
  }
]

Respond with ONLY the JSON array.`;
}

export function buildGameSuggestionPrompt(input: GameSuggestionInput): string {
  const patternBlock = input.friendPatterns
    .map((p) => `- ${p.name}: plays ${p.topGames.join(", ") || "various games"}`)
    .join("\n");

  return `You are a game recommendation assistant for Twitch streamers planning a collab.

## What each streamer actually plays (from stream history)
${patternBlock}

## Currently trending on Twitch
${input.trendingGames.join(", ") || "None available"}

Suggest 5 games that would be great for this group to collab on. Prioritize games they already know and play, but also include 1-2 fresh picks that would work for this group's style.

Return a JSON array with exactly 5 objects:
[{"name": "Game Name", "reason": "1-2 sentences", "isTrending": false}]

Respond with ONLY the JSON array.`;
}

export function buildDiscordMessagePrompt(input: MessageInput): string {
  if (input.messageType === "invite") {
    return `Write a casual, friendly Discord message inviting Twitch streamers to a collab stream.

Event: ${input.eventTitle}
Date/Time: ${input.startTime}
Game: ${input.gameName || "TBD"}
Inviting: ${input.friends.join(", ")}
${input.additionalContext ? `Context: ${input.additionalContext}` : ""}

Keep it casual, under 200 words, exciting. End by asking if they're in. No emojis unless it feels natural.

Respond with ONLY the message text.`;
  }

  return `Write a short Discord reminder for an upcoming Twitch collab stream.

Event: ${input.eventTitle}
Date/Time: ${input.startTime}
Game: ${input.gameName || "TBD"}
With: ${input.friends.join(", ")}
${input.additionalContext ? `Context: ${input.additionalContext}` : ""}

Under 100 words, punchy, creates hype.

Respond with ONLY the message text.`;
}
