// Mirror of lib/twitch/extensionPredictions.ts PanelResponse.

export type PanelResponse =
  | {
      status: "ok";
      summary: {
        topDays: string[];
        medianHour: number;        // in tz below
        tz: string;                // IANA timezone used for binning
        topGame: string | null;
        isEstimate: boolean;
        hasPostedSchedule: boolean;
      };
      collabs: Array<{
        startsAt: string;
        gameName: string | null;
        partners: Array<{ username: string; displayName: string; avatarUrl: string }>;
      }>;
      generatedAt: string;
    }
  | { status: "warming" }
  | { status: "no_data" };
