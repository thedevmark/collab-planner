import Link from "next/link";
import { Twitch } from "lucide-react";

export const metadata = {
  title: "Public API — Collab Planner",
  description: "Read-only endpoints for showing your upcoming collabs on stream or in custom dashboards.",
};

const APP_URL = "https://collab.deutschmark.online";
const BASE = "https://collab.deutschmark.online";

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-md border border-zinc-800/80 bg-black/40 px-4 py-3 text-[12px] font-mono leading-5 text-zinc-300">
      <code>{children}</code>
    </pre>
  );
}

function Inline({ children }: { children: string }) {
  return (
    <code className="rounded bg-zinc-800/70 px-1.5 py-0.5 font-mono text-[12px] text-zinc-200">
      {children}
    </code>
  );
}

export default function PublicApiDocsPage() {
  return (
    <div className="min-h-screen bg-[#09030f] text-zinc-200">
      <header className="sticky top-0 z-10 border-b border-zinc-800/60 bg-[#09030f]/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-6">
          <Link href={APP_URL} className="flex items-center gap-2 text-zinc-400 transition-colors hover:text-zinc-100">
            <Twitch className="h-5 w-5 text-[#9147ff]" />
            <span className="text-sm font-semibold text-zinc-200">Collab Planner</span>
          </Link>
          <nav className="flex items-center gap-4 text-xs text-zinc-500">
            <span className="font-medium text-zinc-300">Public API</span>
            <Link href="/privacy" className="transition-colors hover:text-zinc-300">Privacy</Link>
            <Link href="/terms" className="transition-colors hover:text-zinc-300">Terms</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Public collab API
        </h1>
        <p className="mt-4 text-[15px] leading-7 text-zinc-400">
          Three read-only endpoints that expose your upcoming collabs to anything that can make an HTTP request — an OBS browser source, a Streamer.bot script, a custom dashboard, a Discord bot, a chat command.
        </p>

        <section className="mt-10 space-y-4">
          <h2 className="text-lg font-semibold tracking-tight text-white">Before you start</h2>
          <p className="text-sm leading-7 text-zinc-400">
            The API is <strong className="text-zinc-200">opt-in</strong>. Nothing is exposed by default. Open
            {" "}<Link href="/settings" className="text-[#9147ff] underline underline-offset-4">Settings</Link>{" "}
            and enable <Inline>Public API</Inline>. That flip makes your upcoming events readable by twitch login — nothing else.
          </p>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-7 text-zinc-400">
            <li>Only future events with status <Inline>planned</Inline> or <Inline>confirmed</Inline> are exposed.</li>
            <li>Your participant list comes through (display name, login, avatar) but private notes, descriptions, and canceled events do not.</li>
            <li>Read-only. No endpoint creates, modifies, or deletes anything.</li>
            <li>CORS is wide open for anonymous browser callers — you can fetch this directly from a custom OBS browser source without a proxy.</li>
          </ul>
        </section>

        <section className="mt-12 space-y-4">
          <h2 className="text-lg font-semibold tracking-tight text-white">
            <Inline>GET /api/public/profile</Inline>
          </h2>
          <p className="text-sm leading-7 text-zinc-400">
            Check if a user has opted in. Safe to call before hitting the other endpoints so you can render a friendly &ldquo;not enabled&rdquo; state.
          </p>
          <CodeBlock>{`curl "${BASE}/api/public/profile?user=thedeutschmark"`}</CodeBlock>
          <CodeBlock>{`{
  "exists": true,
  "enabled": true,
  "displayName": "thedeutschmark",
  "avatarUrl": "https://...",
  "channelColor": "#9147ff",
  "timezone": "America/New_York"
}`}</CodeBlock>
          <p className="text-xs text-zinc-500">
            Returns <Inline>{"{ exists: true, enabled: false }"}</Inline> if the user exists but hasn&apos;t enabled the API. Returns <Inline>{"{ exists: false }"}</Inline> if the login is unknown. Never 404s — always 200 with a flag.
          </p>
        </section>

        <section className="mt-12 space-y-4">
          <h2 className="text-lg font-semibold tracking-tight text-white">
            <Inline>GET /api/public/next-collab</Inline>
          </h2>
          <p className="text-sm leading-7 text-zinc-400">
            The single next upcoming collab. Returns <Inline>{"{ event: null }"}</Inline> if nothing is scheduled.
          </p>
          <CodeBlock>{`curl "${BASE}/api/public/next-collab?user=thedeutschmark"`}</CodeBlock>
          <CodeBlock>{`{
  "event": {
    "id": 42,
    "title": "Friday night co-op run",
    "startTime": "2026-04-12T23:00:00.000Z",
    "endTime": "2026-04-13T02:00:00.000Z",
    "gameName": "Elden Ring",
    "status": "confirmed",
    "participants": [
      {
        "displayName": "partnerstreamer",
        "login": "partnerstreamer",
        "avatarUrl": "https://...",
        "inviteStatus": "accepted"
      }
    ]
  }
}`}</CodeBlock>
        </section>

        <section className="mt-12 space-y-4">
          <h2 className="text-lg font-semibold tracking-tight text-white">
            <Inline>GET /api/public/upcoming-collabs</Inline>
          </h2>
          <p className="text-sm leading-7 text-zinc-400">
            A list of upcoming collabs. Default limit 5, max 25.
          </p>
          <CodeBlock>{`curl "${BASE}/api/public/upcoming-collabs?user=thedeutschmark&limit=10"`}</CodeBlock>
          <CodeBlock>{`{ "events": [ /* array of event objects, same shape as next-collab */ ] }`}</CodeBlock>
        </section>

        <section className="mt-12 space-y-4">
          <h2 className="text-lg font-semibold tracking-tight text-white">Error codes</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-7 text-zinc-400">
            <li><Inline>400 missing_user</Inline> — query param was empty or missing</li>
            <li><Inline>403 not_enabled</Inline> — user exists but hasn&apos;t opted into the public API</li>
            <li><Inline>404 user_not_found</Inline> — no collab profile matches that twitch login</li>
            <li><Inline>500 internal_error</Inline> — something broke server-side. Check /api/health and try again.</li>
          </ul>
        </section>

        <section className="mt-12 space-y-4">
          <h2 className="text-lg font-semibold tracking-tight text-white">
            Practical example: &ldquo;next collab&rdquo; OBS overlay
          </h2>
          <p className="text-sm leading-7 text-zinc-400">
            Save this as <Inline>next-collab.html</Inline> and drop it into OBS as a local-file browser source. It
            polls every 5 minutes and paints the next collab title in the top-right corner of your scene.
          </p>
          <CodeBlock>{`<!doctype html>
<meta charset="utf-8">
<title>Next collab</title>
<style>
  body { margin:0; font:600 28px/1.2 sans-serif; color:#fff;
         background:transparent; padding:24px; }
  .label { font-size:12px; letter-spacing:.18em; text-transform:uppercase;
           color:#a78bfa; opacity:.9; }
  .title { margin-top:6px; text-shadow:0 2px 8px rgba(0,0,0,.6); }
  .when  { margin-top:4px; font-size:16px; opacity:.82; }
</style>
<div class="label">Next collab</div>
<div class="title" id="t"></div>
<div class="when" id="w"></div>
<script>
  const USER = "thedeutschmark";
  async function tick() {
    const res = await fetch(
      "${BASE}/api/public/next-collab?user=" + encodeURIComponent(USER),
      { cache: "no-store" }
    );
    const data = await res.json();
    const event = data.event;
    if (!event) {
      document.getElementById("t").textContent = "nothing scheduled";
      document.getElementById("w").textContent = "";
      return;
    }
    const names = event.participants.map(p => p.displayName).join(", ");
    document.getElementById("t").textContent =
      event.title + (names ? "  ·  w/ " + names : "");
    const when = new Date(event.startTime);
    document.getElementById("w").textContent = when.toLocaleString();
  }
  tick();
  setInterval(tick, 5 * 60 * 1000);
</script>`}</CodeBlock>
        </section>

        <section className="mt-12 space-y-4">
          <h2 className="text-lg font-semibold tracking-tight text-white">Chat command example (Streamer.bot)</h2>
          <p className="text-sm leading-7 text-zinc-400">
            Wire a chat trigger like <Inline>!nextcollab</Inline> to a Fetch URL sub-action pointing at{" "}
            <Inline>{`${BASE}/api/public/next-collab?user=YOURLOGIN`}</Inline>. Parse the JSON in a C# sub-action,
            then reply in chat with the event title + start time. No extra auth, no API keys.
          </p>
        </section>

        <section className="mt-12 border-t border-zinc-800/60 pt-6 text-xs text-zinc-500">
          <p>
            Questions or found a bug?{" "}
            <a href="https://github.com/thedeutschmark/deutschmark.online/issues" className="text-zinc-300 underline underline-offset-4">
              Open an issue
            </a>{" "}
            or ping{" "}
            <a href="https://twitch.tv/thedeutschmark" className="text-zinc-300 underline underline-offset-4">
              @thedeutschmark
            </a>{" "}
            on Twitch.
          </p>
        </section>
      </main>
    </div>
  );
}
