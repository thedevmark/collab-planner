import Link from "next/link";
import { Logo } from "@/components/Logo";

export const metadata = {
  title: "Privacy Policy — Collab Planner",
  description: "How Collab Planner collects, uses, and protects your data — Twitch + Discord OAuth scopes, retention, your rights.",
};

const LAST_UPDATED = "June 4, 2026";
const CONTACT_EMAIL = "deutschmarkonline@gmail.com";
const APP_URL = "https://collab.deutschmark.online";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href={APP_URL} className="flex items-center text-muted-foreground hover:text-foreground transition-colors">
            <Logo width={108} height={60} />
          </Link>
          <nav className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="text-foreground font-medium">Privacy Policy</span>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-14">

        {/* Hero */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#9147ff]/10 border border-[#9147ff]/30 text-[#9147ff] text-xs font-medium mb-4">
            Legal
          </div>
          <h1 className="text-4xl font-bold mb-3">Privacy Policy</h1>
          <p className="text-muted-foreground text-sm">Last updated: {LAST_UPDATED}</p>
          <p className="mt-4 leading-relaxed">
            Collab Planner is built for Twitch streamers who want to plan and coordinate
            collaborations with friends. This policy explains what data we collect, why we
            collect it, how it&apos;s stored, and how you can control it.
          </p>
          <p className="mt-3 leading-relaxed text-muted-foreground text-sm">
            Collab Planner is operated globally for Twitch creators. Application infrastructure is
            hosted by Vercel and the database by Supabase, both in US regions. By using the service
            you consent to the cross-border processing described below, where applicable to your
            jurisdiction.
          </p>
        </div>

        <div className="space-y-10">

          <Section id="data-collected" title="1. Data We Collect">
            <p>We collect only what is needed to operate the service.</p>

            <SubSection title="From Twitch OAuth (required to sign in)">
              <p className="text-muted-foreground mb-2">
                Sign-in goes through Supabase Auth using Twitch as the identity provider. The
                following scopes are requested:
              </p>
              <Table rows={[
                ["user:read:email", "Read your Twitch email so we can identify your account uniquely."],
                ["user:read:follows", "Read who you follow on Twitch — used to suggest friends and detect co-stream signals."],
                ["moderator:read:followers", "Read your follower list when you import friends from your audience."],
              ]} />
              <p className="mt-3 text-muted-foreground text-sm">
                We never request scopes that allow posting to chat, modifying your channel, or
                managing your account beyond reading the data above.
              </p>
            </SubSection>

            <SubSection title="From the Twitch Helix API (refreshed via your token)">
              <ul>
                <li>Display name, login (handle), profile image URL, channel ID, broadcaster type</li>
                <li>Your stream history — VOD titles, dates, durations, game IDs — used to estimate your typical streaming windows and infer co-streams from VOD metadata</li>
                <li>Your scheduled stream segments where Twitch publishes them, used to anchor calendar predictions</li>
                <li>Your channel color (hex), used in calendar UI</li>
              </ul>
            </SubSection>

            <SubSection title="From Discord OAuth (optional)">
              <p className="text-muted-foreground mb-2">
                Discord is optional. If you connect it, the following scopes are requested:
              </p>
              <Table rows={[
                ["identify", "Read your Discord user ID and username so we know which account is connected."],
                ["guilds", "List the servers you belong to so you can pick one to send notifications to."],
                ["webhook.incoming", "Create and use an incoming webhook in the channel you authorize, to post collab event notifications."],
              ]} />
              <p className="mt-3 text-muted-foreground text-sm">
                Discord access and refresh tokens are stored encrypted at rest in the database and
                are never exposed in client responses or server logs.
              </p>
            </SubSection>

            <SubSection title="Data you create in the app">
              <ul>
                <li>Collab events — title, date, time, participants, game, notes</li>
                <li>Friend list — Twitch handles you choose to track, plus optional notes you write on friend profiles</li>
                <li>Timezone preference</li>
                <li>Theme preference (light, dark, or match-system) stored in your browser&apos;s localStorage</li>
              </ul>
            </SubSection>

            <SubSection title="Automatically collected">
              <ul>
                <li>Standard server access logs — IP address, user agent, request path — retained for up to 30 days for security and abuse investigation</li>
                <li>Supabase auth session metadata — last sign-in time, refresh token rotation</li>
                <li>No analytics trackers, no fingerprinting, no advertising cookies</li>
              </ul>
            </SubSection>
          </Section>

          <Divider />

          <Section id="how-used" title="2. How We Use Your Data">
            <Table rows={[
              ["Display name, avatar", "Render your profile in the app UI and on shared event pages"],
              ["Email", "Account identity within Supabase Auth and out-of-band contact for security or legal matters"],
              ["Stream history (VODs)", "Estimate your typical streaming windows and surface co-streams from VOD metadata"],
              ["Schedule segments", "Anchor calendar predictions to your published stream schedule"],
              ["Follow list / followers", "Power friend suggestions and import flows"],
              ["Discord tokens", "Post collab event notifications to the channel you chose"],
              ["Friend list + notes", "Track your collaborator network and personal context"],
              ["Collab events", "Calendar display, Discord notifications, reminder scheduling"],
              ["Timezone", "Format all displayed times in your local time"],
            ]} />
            <p className="mt-4">
              We do not sell your data, share it with advertisers, or use it to train machine
              learning models. Data is used solely to operate the Collab Planner service for you.
            </p>
          </Section>

          <Divider />

          <Section id="storage" title="3. Data Storage & Security">
            <p>
              The application is hosted on{" "}
              <ExternalLink href="https://vercel.com">Vercel</ExternalLink> (US region). The
              database is{" "}
              <ExternalLink href="https://supabase.com">Supabase</ExternalLink> Postgres, also in a
              US region. Both vendors maintain SOC 2 Type II controls and encrypt data at rest and
              in transit.
            </p>
            <p className="mt-3">
              Discord OAuth tokens are encrypted at the application layer before being written to
              the database. The encryption key is held in the application&apos;s environment and is
              never exposed to clients or logs.
            </p>
            <p className="mt-3">
              We use HTTPS exclusively. Session cookies are httpOnly and SameSite=Lax. Server-side
              checks gate every API endpoint that returns or mutates user data.
            </p>
          </Section>

          <Divider />

          <Section id="extension" title="4. The Twitch Panel Extension">
            <p>
              Collab Planner publishes a Twitch Panel Extension called &ldquo;Schedule Forecast by
              Collab Planner.&rdquo; Broadcasters install it on their Twitch channel page from the
              Twitch Extension directory. The data handling for the extension differs from the rest
              of the Service and is detailed below.
            </p>

            <SubSection title="Viewers of the panel">
              <ul>
                <li>No Twitch identity is requested. Twitch supplies only an opaque per-channel viewer ID, which we never store and never associate with any account.</li>
                <li>No cookies are set by the panel; no analytics, fingerprinting, or advertising trackers are loaded.</li>
                <li>Each request the panel makes carries a short-lived JWT signed by Twitch that identifies only the channel the panel is rendering on. We verify that signature before returning data.</li>
                <li>Standard server access logs (IP, user agent, request path) apply per Section 1 — retained up to 30 days for security/abuse investigation.</li>
                <li>The panel contains no off-site links and performs no outbound navigation.</li>
              </ul>
            </SubSection>

            <SubSection title="The broadcaster the panel is rendering on">
              <ul>
                <li>If the broadcaster already has a Collab Planner account, the panel surfaces predicted streaming windows computed from their broadcast history and any posted Twitch schedule. It is a forecast — it does not list individual planned events or collabs.</li>
                <li>If the broadcaster does <strong>not</strong> have a Collab Planner account, the panel still works: we fetch their public Twitch VOD history on demand via the Twitch Helix API, compute predicted streaming windows, and cache the result for up to 24 hours in our database (the <code>ExtensionPredictionCache</code> table). No other personal data is collected, no account is created on their behalf, and only data Twitch already exposes publicly via Helix is read.</li>
                <li>Broadcasters can opt out at any time by emailing <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#9147ff] hover:underline">{CONTACT_EMAIL}</a>. We delete the cache entry and add the channel to a no-fetch list within 7 days.</li>
              </ul>
            </SubSection>

            <SubSection title="Broadcaster config view">
              <p className="text-muted-foreground text-sm">
                The Twitch dashboard config view is broadcaster-only. It confirms the panel is live
                and lets the broadcaster set display preferences (timezone, clock format, theme,
                accent color). No data is collected from this view beyond the standard JWT verification.
              </p>
            </SubSection>
          </Section>

          <Divider />

          <Section id="third-party" title="5. Third-Party Services">
            <p>Collab Planner integrates with the services below. Each has its own privacy policy.</p>
            <Table rows={[
              ["Twitch", "Authentication, stream data, schedule data, follow graph", "https://www.twitch.tv/p/legal/privacy-policy"],
              ["Discord", "Optional notifications via incoming webhooks", "https://discord.com/privacy"],
              ["Supabase", "Authentication, encrypted Postgres database", "https://supabase.com/privacy"],
              ["Vercel", "Application hosting and edge delivery", "https://vercel.com/legal/privacy-policy"],
            ]} hasLinks />
            <p className="mt-4 text-muted-foreground text-sm">
              We encourage you to review each policy. Your use of those platforms within the
              Collab Planner experience is also governed by their terms.
            </p>
          </Section>

          <Divider />

          <Section id="retention" title="6. Data Retention">
            <p>Concrete retention windows:</p>
            <ul>
              <li>Stream history older than 12 months may be pruned to manage storage</li>
              <li>Reminder records: marked sent and retained for 90 days, then deleted</li>
              <li>Server access logs: deleted after 30 days</li>
              <li>Discord OAuth tokens: deleted immediately when you disconnect Discord, or within 7 days of the last refresh failure</li>
              <li>Extension prediction cache entries (for channels without a Collab Planner account): 24 hours by default; deleted within 7 days on opt-out request</li>
              <li>When you request account deletion: all personal data is purged within 30 days, plus a 7-day buffer for backup rotation</li>
            </ul>
          </Section>

          <Divider />

          <Section id="rights" title="7. Your Rights">
            <p>Depending on your jurisdiction, you may have one or more of the following rights:</p>
            <ul>
              <li><strong className="text-foreground">Access</strong> — request a copy of all data we hold about you</li>
              <li><strong className="text-foreground">Correction</strong> — update inaccurate data via the app settings or email request</li>
              <li><strong className="text-foreground">Deletion</strong> — request complete account and data deletion</li>
              <li><strong className="text-foreground">Portability</strong> — request your data in a machine-readable JSON export</li>
              <li><strong className="text-foreground">Disconnect</strong> — revoke Discord access from in-app Settings; revoke Twitch access via your Twitch account&apos;s connected applications page</li>
              <li><strong className="text-foreground">Objection / opt-out of certain processing</strong> — under GDPR, CCPA, and similar regimes</li>
            </ul>
            <p className="mt-4">
              We honor the Global Privacy Control (GPC) signal where applicable. To exercise any of
              these rights, email{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#9147ff] hover:underline">{CONTACT_EMAIL}</a>.
              We respond within 14 days, or sooner where required by law.
            </p>
            <p className="mt-3 text-muted-foreground text-sm">
              EU/UK residents have the right to lodge a complaint with their local data protection
              authority. California residents have rights under the CCPA/CPRA, including the right
              to know, delete, correct, and limit use of sensitive personal information. We do not
              sell or share personal data as those terms are defined under the CCPA.
            </p>
          </Section>

          <Divider />

          <Section id="international" title="8. International Transfers">
            <p>
              If you access Collab Planner from outside the United States, your data is transferred
              to and processed in the US by Supabase and Vercel. We rely on the Standard
              Contractual Clauses (SCCs) and equivalent transfer mechanisms maintained by those
              vendors for cross-border transfers from the EEA, UK, and Switzerland.
            </p>
          </Section>

          <Divider />

          <Section id="breach" title="9. Security Incidents">
            <p>
              In the unlikely event of a security incident affecting your data, we will notify
              affected users by email within 72 hours of confirmation, where practicable, and
              comply with applicable breach-notification laws (including GDPR Article 33, CCPA
              §1798.82, and equivalents). Notifications will describe the nature of the incident,
              the data categories involved, and remediation steps you may need to take.
            </p>
          </Section>

          <Divider />

          <Section id="children" title="10. Children's Privacy">
            <p>
              Collab Planner requires a Twitch account, and Twitch requires its users to be at
              least 13. We do not knowingly collect personal information from anyone under 13. If
              you believe a child has provided us data, contact{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#9147ff] hover:underline">{CONTACT_EMAIL}</a>{" "}
              and we will delete it promptly.
            </p>
          </Section>

          <Divider />

          <Section id="changes" title="11. Changes to This Policy">
            <p>
              We may update this policy to reflect changes in the service, the law, or operational
              practices. Material changes will be communicated by updating the &ldquo;Last
              updated&rdquo; date above; significant changes that affect how your data is used
              will also be highlighted in-app where reasonable. Continued use of the service after
              the effective date of a change constitutes acceptance.
            </p>
          </Section>

          <Divider />

          <Section id="contact" title="12. Contact">
            <p>
              Questions, requests, or complaints about this policy:{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#9147ff] hover:underline">
                {CONTACT_EMAIL}
              </a>
            </p>
          </Section>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-16">
        <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Logo width={72} height={40} />
            <span className="text-muted-foreground/60">·</span>
            <span>{new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-5 text-xs text-muted-foreground">
            <span className="text-foreground">Privacy Policy</span>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
            <Link href="/" className="hover:text-foreground transition-colors">Back to App</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      <div className="space-y-3 leading-relaxed text-sm [&_ul]:space-y-2 [&_ul]:list-none [&_ul>li]:flex [&_ul>li]:gap-2 [&_ul>li]:before:content-['—'] [&_ul>li]:before:text-muted-foreground [&_ul>li]:before:shrink-0">
        {children}
      </div>
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold mb-2">{title}</h3>
      {children}
    </div>
  );
}

function Divider() {
  return <hr className="border-border" />;
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#9147ff] hover:underline">
      {children}
    </a>
  );
}

function Table({ rows, hasLinks }: { rows: string[][]; hasLinks?: boolean }) {
  return (
    <div className="mt-3 rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border last:border-0">
              <td className="px-4 py-3 font-medium w-1/4 align-top">{row[0]}</td>
              <td className="px-4 py-3 text-muted-foreground align-top">{row[1]}</td>
              {hasLinks && row[2] && (
                <td className="px-4 py-3 text-right align-top">
                  <a href={row[2]} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-[#9147ff] transition-colors">
                    Policy ↗
                  </a>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
