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
