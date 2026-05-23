import type { PanelResponse } from "./types";

const API_BASE = "https://collab.deutschmark.online";

export async function fetchPanel(channelId: string, token: string): Promise<PanelResponse> {
  const res = await fetch(`${API_BASE}/api/extension/channel/${channelId}/panel`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`panel fetch failed: ${res.status}`);
  }
  return (await res.json()) as PanelResponse;
}
