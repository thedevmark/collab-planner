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
  gameHint?: string; // free-text hint from the user: game name, genre, vibe, etc.
}

export interface MessageInput {
  messageType: "invite" | "reminder";
  eventTitle: string;
  startTime: string;
  gameName: string;
  friends: string[];
  additionalContext?: string;
}

const ANTI_SLOP_BAN_LIST = [
  "delve",
  "unlock",
  "tapestry",
  "pivotal",
  "multifaceted",
  "transformative",
  "foster",
  "navigate",
  "comprehensive",
];

function buildAntiSlopStyleBlock(messageType: MessageInput["messageType"]): string {
  const structuralGoal = messageType === "invite"
    ? "Open with the ask. Sound like a real person sending a DM to a friend they actually want to play with."
    : "Keep it tight. Sound like a genuine heads-up from a friend, not a calendar notification.";

  return `Style Guidelines:
- Tone: Warm and genuine. Friendly without being performative. Like a streamer DM-ing someone they actually like and want to collab with.
- Voice: Active voice. Conversational. A little casual, but not trying too hard.
- Structure: No sandwich formatting. No generic intro paragraph. No concluding summary. Get to the point but be human about it.
- Flow: Natural rhythm. Mix short lines with longer ones. Don't sound robotic or over-structured.
- Verbs: Prefer simple verbs like join, play, stream, lock in, hop on, let me know.
- Details: Use concrete details from the event. If there is a game, name it. If there is a time, use it.
- Perspective: Write like a person inviting a friend — genuine interest, no pressure, just a real ask.
- Negative Constraints: Do not use these words or anything close to them: ${ANTI_SLOP_BAN_LIST.join(", ")}.
- Negative Constraints: Do not write phrases like "it's important to note", "overall", "in conclusion", "while X, it's also Y", or "just checking in".
- Negative Constraints: Do not sound cold, dismissive, demanding, or like you're issuing an ultimatum. Do not sound like a brand, life coach, or LinkedIn post.
- ${structuralGoal}`;
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

  const hintBlock = input.gameHint
    ? `\n## User's game/genre hint\n"${input.gameHint}" — lean toward this if it fits the group.\n`
    : "";

  return `You are a game recommendation assistant for Twitch streamers planning a collab.

## What each streamer actually plays (from stream history)
${patternBlock}
${hintBlock}
## Currently trending on Twitch
${input.trendingGames.join(", ") || "None available"}

Suggest 5 games that would be great for this group to collab on. Prioritize games they already know and play, but also include 1-2 fresh picks that would work for this group's style.

Return a JSON array with exactly 5 objects:
[{"name": "Game Name", "reason": "1-2 sentences", "isTrending": false}]

Respond with ONLY the JSON array.`;
}

export function buildDiscordMessagePrompt(input: MessageInput): string {
  if (input.messageType === "invite") {
    return `Write a Discord message inviting Twitch streamers to a collab stream.

Event: ${input.eventTitle}
Date/Time: ${input.startTime}
Game: ${input.gameName || "TBD"}
Inviting: ${input.friends.join(", ")}
${input.additionalContext ? `Context: ${input.additionalContext}` : ""}

${buildAntiSlopStyleBlock("invite")}

Message rules:
- Under 120 words.
- Make it sound like a real DM you would actually send.
- Ask clearly whether they are in.
- Use at most one question mark.
- Emojis are off by default. Use none unless the context really calls for it.

Respond with ONLY the message text.`;
  }

  return `Write a short Discord reminder for an upcoming Twitch collab stream.

Event: ${input.eventTitle}
Date/Time: ${input.startTime}
Game: ${input.gameName || "TBD"}
With: ${input.friends.join(", ")}
${input.additionalContext ? `Context: ${input.additionalContext}` : ""}

${buildAntiSlopStyleBlock("reminder")}

Message rules:
- Under 80 words.
- Punchy, but not hype-man nonsense.
- Sound like a practical reminder from a real person.
- Reference the time and the plan.
- No emojis.

Respond with ONLY the message text.`;
}
