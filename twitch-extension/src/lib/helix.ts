// Direct Helix calls from the panel iframe using the helixToken Twitch
// hands us via window.Twitch.ext.onAuthorized.
//
// Why bother when the backend already returns liveNow?
//   - The backend's cache is 24h. liveNow is overlaid fresh on cache
//     reads, but the panel only re-reads on full reload.
//   - Polling here lets the LIVE indicator flip within ~60s of the
//     broadcaster going on/off air, without round-tripping our backend.
//   - Saves backend Vercel cost per viewer-render.

interface LiveStream {
  startedAt: string;
  gameName: string | null;
  title: string | null;
}

interface HelixStreamRaw {
  user_id: string;
  user_login: string;
  user_name: string;
  game_id: string;
  game_name: string;
  type: string;
  title: string;
  viewer_count: number;
  started_at: string;
  language: string;
  thumbnail_url: string;
}

/** Fetch the current live stream for a channel directly from Helix. Returns
 *  the live data if the channel is currently broadcasting, null if offline
 *  or if the helixToken is missing/invalid. Never throws — failures degrade
 *  to "no live info" rather than breaking the panel. */
export async function fetchLiveStream(
  channelId: string,
  helixToken: string,
  clientId: string,
): Promise<LiveStream | null> {
  if (!helixToken || !clientId) return null;
  try {
    const res = await fetch(`https://api.twitch.tv/helix/streams?user_id=${encodeURIComponent(channelId)}`, {
      headers: {
        // The extension helixToken uses the "Extension" scheme, NOT "Bearer".
        Authorization: `Extension ${helixToken}`,
        "Client-Id": clientId,
      },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: HelixStreamRaw[] };
    const stream = body.data?.[0];
    if (!stream) return null;
    return {
      startedAt: stream.started_at,
      gameName: stream.game_name || null,
      title: stream.title || null,
    };
  } catch {
    return null;
  }
}
