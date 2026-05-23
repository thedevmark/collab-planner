// Mirror of lib/twitch/extensionPredictions.ts PanelResponse.

export type PanelResponse =
  | {
      status: "ok";
      predictions: Array<{
        day: string;
        startsAt: string;
        durationHours: number;
        confidence: 1 | 2 | 3;
        isPosted: boolean;
      }>;
      collabs: Array<{
        startsAt: string;
        gameName: string | null;
        partners: Array<{ username: string; displayName: string; avatarUrl: string }>;
      }>;
      generatedAt: string;
    }
  | { status: "warming" }
  | { status: "no_data" };
