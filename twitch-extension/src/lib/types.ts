// Mirror of lib/twitch/extensionPredictions.ts PanelResponse.

export type PanelResponse =
  | {
      status: "ok";
      summary: {
        topDays: string[];
        medianHour: number;        // in tz below
        tz: string;                // IANA timezone used for binning
        topGame: string | null;
        topGames: string[];
        isEstimate: boolean;
        hasPostedSchedule: boolean;
        hourDistribution: number[];   // length 24, values 0-1
        dayFrequency: number[];       // length 7, values 0-1, index 0 = Sunday
        avgDurationHours: number;     // typical session length in hours
        perDay: Array<{
          dow: number;
          startHour: number;
          durationHours: number;
          confidence: "high" | "low";
        }>;
        broadcasterAvatar: string | null;  // Twitch profile image URL
        broadcasterName: string | null;    // Twitch display name
      };
      collabs: Array<{
        startsAt: string;
        gameName: string | null;
        partners: Array<{ username: string; displayName: string; avatarUrl: string }>;
      }>;
      lastStream: { startedAt: string; gameName: string | null; durationSec: number } | null;
      liveNow: { startedAt: string; gameName: string | null; title: string | null } | null;
      generatedAt: string;
    }
  | { status: "warming" }
  | { status: "no_data" };
