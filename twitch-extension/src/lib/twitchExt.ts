// Minimal typed wrapper around window.Twitch.ext. Only exposes what we use.

export interface TwitchAuth {
  channelId: string;
  clientId: string;
  token: string;
  userId: string;
}

interface TwitchExtGlobal {
  onAuthorized: (cb: (auth: TwitchAuth) => void) => void;
  onContext?: (cb: (ctx: Record<string, unknown>) => void) => void;
  configuration?: {
    broadcaster?: { content?: string; version?: string };
    onChanged?: (cb: () => void) => void;
  };
}

declare global {
  interface Window {
    Twitch?: { ext?: TwitchExtGlobal };
  }
}

/** Resolve once the Twitch Helper hands us a JWT. */
export function awaitAuthorized(timeoutMs = 10_000): Promise<TwitchAuth> {
  return new Promise((resolve, reject) => {
    const ext = window.Twitch?.ext;
    if (!ext) {
      reject(new Error("Twitch Extension Helper not loaded"));
      return;
    }
    const timer = setTimeout(() => reject(new Error("onAuthorized timeout")), timeoutMs);
    ext.onAuthorized((auth) => {
      clearTimeout(timer);
      resolve(auth);
    });
  });
}

/** Resolve once the broadcaster's stored configuration has loaded. */
export function awaitConfiguration(timeoutMs = 5_000): Promise<string | null> {
  return new Promise((resolve) => {
    const ext = window.Twitch?.ext;
    if (!ext?.configuration) {
      resolve(null);
      return;
    }
    // configuration.broadcaster may already be populated synchronously
    if (ext.configuration.broadcaster?.content !== undefined) {
      resolve(ext.configuration.broadcaster.content ?? null);
      return;
    }
    const timer = setTimeout(() => resolve(null), timeoutMs);
    ext.configuration.onChanged?.(() => {
      clearTimeout(timer);
      resolve(ext.configuration?.broadcaster?.content ?? null);
    });
  });
}

/** Persist broadcaster config to Twitch's Configuration Service. */
export function setBroadcasterConfiguration(version: string, content: string): void {
  const ext = window.Twitch?.ext;
  if (!ext?.configuration) {
    throw new Error("Twitch.ext.configuration not available");
  }
  // The helper API is `Twitch.ext.configuration.set(segment, version, content)`
  // (untyped in the helper). Cast through unknown.
  const cfg = ext.configuration as unknown as {
    set: (segment: "broadcaster", version: string, content: string) => void;
  };
  cfg.set("broadcaster", version, content);
}
