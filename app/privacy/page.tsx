import Link from "next/link";
import { Twitch } from "lucide-react";

export const metadata = {
  title: "Privacy Policy — Collab Planner",
  description: "How Collab Planner collects, uses, and protects your data.",
};

const LAST_UPDATED = "March 25, 2026";
const CONTACT_EMAIL = "privacy@deutschmark.online";
const APP_URL = "https://collab.deutschmark.online";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#09030f] text-zinc-200">

      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-800/60 bg-[#09030f]/90 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href={APP_URL} className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 transition-colors">
            <Twitch className="h-5 w-5 text-[#9147ff]" />
            <span className="text-sm font-semibold text-zinc-200">Collab Planner</span>
          </Link>
          <nav className="flex items-center gap-4 text-xs text-zinc-500">
            <span className="text-zinc-300 font-medium">Privacy Policy</span>
            <Link href="/terms" className="hover:text-zinc-300 transition-colors">Terms of Service</Link>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-14">

        {/* Hero */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#9147ff]/10 border border-[#9147ff]/20 text-[#9147ff] text-xs font-medium mb-4">
            Legal
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">Privacy Policy</h1>
          <p className="text-zinc-400 text-sm">Last updated: {LAST_UPDATED}</p>
          <p className="mt-4 text-zinc-300 leading-relaxed">
            Collab Planner is built for Twitch streamers who want to plan and coordinate
            collaborations with friends. This policy explains what data we collect, why we
            collect it, and how you can control it.
          </p>
        </div>

        <div className="space-y-10">

          <Section id="data-collected" title="1. Data We Collect">
            <p>We collect only what is necessary to provide the service.</p>
            <SubSection title="From Twitch OAuth">
              <ul>
                <li>Display name, username, and profile picture</li>
                <li>Twitch user ID (used to identify your account)</li>
                <li>Your stream history (video titles, dates, durations, games) — fetched via the Twitch API to power scheduling predictions</li>
                <li>Your Twitch channel color and scheduled stream segments</li>
              </ul>
            </SubSection>
            <SubSection title="From Discord OAuth (optional)">
              <ul>
                <li>Discord username and user ID</li>
                <li>Access and refresh tokens — stored securely to post notifications on your behalf</li>
                <li>Your selected Discord server and channel IDs</li>
              </ul>
            </SubSection>
            <SubSection title="Data you create">
              <ul>
                <li>Collab events (title, date, participants, game)</li>
                <li>Friend lists (Twitch usernames you choose to track)</li>
                <li>Personal notes you write on friend profiles</li>
                <li>Timezone preference</li>
              </ul>
            </SubSection>
            <SubSection title="Automatically collected">
              <ul>
                <li>Standard server logs (IP address, user agent) retained for up to 30 days for security purposes</li>
                <li>We do not use analytics trackers, fingerprinting, or advertising cookies</li>
              </ul>
            </SubSection>
          </Section>

          <Divider />

          <Section id="how-used" title="2. How We Use Your Data">
            <Table rows={[
              ["Display name, avatar", "Show your profile in the app UI"],
              ["Stream history", "Calculate your typical streaming patterns and predict scheduling overlaps with friends"],
              ["Discord tokens", "Post collab event notifications and create Discord Scheduled Events in your server"],
              ["Friend list", "Track your collaborator network and detect co-streaming signals from VOD titles"],
              ["Collab events", "Calendar display, Discord notifications, reminder scheduling"],
              ["Timezone", "Format all displayed times in your local time"],
            ]} />
            <p className="mt-4">
              We do not sell your data, share it with advertisers, or use it to train machine
              learning models. Data is used solely to operate the Collab Planner service.
            </p>
          </Section>

          <Divider />

          <Section id="storage" title="3. Data Storage &amp; Security">
            <p>
              Your data is stored in a PostgreSQL database hosted by{" "}
              <ExternalLink href="https://supabase.com">Supabase</ExternalLink> (US region).
              The application is hosted on{" "}
              <ExternalLink href="https://vercel.com">Vercel</ExternalLink>.
              Both services maintain SOC 2 compliance and encrypt data at rest and in transit.
            </p>
            <p className="mt-3">
              OAuth tokens (Twitch, Discord) are stored encrypted in the database and are never
              exposed in client-side responses or logs.
            </p>
          </Section>

          <Divider />

          <Section id="third-party" title="4. Third-Party Services">
            <p>Collab Planner integrates with the following external services:</p>
            <Table rows={[
              ["Twitch", "Authentication, stream data, schedule data", "https://www.twitch.tv/p/legal/privacy-policy"],
              ["Discord", "Optional notifications and scheduled events", "https://discord.com/privacy"],
              ["Supabase", "Database and authentication infrastructure", "https://supabase.com/privacy"],
              ["Vercel", "Application hosting and edge delivery", "https://vercel.com/legal/privacy-policy"],
            ]} hasLinks />
            <p className="mt-4">
              Each of these services has its own privacy policy governing the data they process.
              We encourage you to review them.
            </p>
          </Section>

          <Divider />

          <Section id="retention" title="5. Data Retention">
            <p>
              Your data is retained for as long as you maintain an account. Specifically:
            </p>
            <ul>
              <li>Stream history older than 12 months may be pruned to manage storage</li>
              <li>Reminder records are marked as sent and retained for 90 days</li>
              <li>Server access logs are deleted after 30 days</li>
              <li>When you delete your account, all personal data is permanently deleted within 30 days</li>
            </ul>
          </Section>

          <Divider />

          <Section id="rights" title="6. Your Rights">
            <p>You have the right to:</p>
            <ul>
              <li><strong className="text-white">Access</strong> — request a copy of all data we hold about you</li>
              <li><strong className="text-white">Correction</strong> — update inaccurate data via the app settings</li>
              <li><strong className="text-white">Deletion</strong> — request complete account and data deletion</li>
              <li><strong className="text-white">Portability</strong> — request your data in a machine-readable format</li>
              <li><strong className="text-white">Disconnect</strong> — revoke Discord access at any time from Settings; revoke Twitch access via your Twitch account connections page</li>
            </ul>
            <p className="mt-4">
              To exercise any of these rights, email{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#9147ff] hover:underline">{CONTACT_EMAIL}</a>.
              We will respond within 14 days.
            </p>
          </Section>

          <Divider />

          <Section id="children" title="7. Children's Privacy">
            <p>
              Collab Planner requires a Twitch account to use. Twitch requires users to be at
              least 13 years old. We do not knowingly collect data from children under 13. If you
              believe a child has provided us with personal information, please contact us and we
              will delete it promptly.
            </p>
          </Section>

          <Divider />

          <Section id="changes" title="8. Changes to This Policy">
            <p>
              We may update this policy to reflect changes in the service or legal requirements.
              Material changes will be communicated by updating the "Last updated" date above.
              Continued use of the service after changes constitutes acceptance of the revised policy.
            </p>
          </Section>

          <Divider />

          <Section id="contact" title="9. Contact">
            <p>
              Questions or requests about this policy:{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#9147ff] hover:underline">
                {CONTACT_EMAIL}
              </a>
            </p>
          </Section>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/60 mt-16">
        <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-zinc-500 text-sm">
            <Twitch className="h-4 w-4 text-[#9147ff]" />
            <span>Collab Planner</span>
            <span className="text-zinc-700">·</span>
            <span>{new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-5 text-xs text-zinc-500">
            <span className="text-zinc-400">Privacy Policy</span>
            <Link href="/terms" className="hover:text-zinc-300 transition-colors">Terms of Service</Link>
            <Link href="/" className="hover:text-zinc-300 transition-colors">Back to App</Link>
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
      <h2 className="text-xl font-semibold text-white mb-4">{title}</h2>
      <div className="space-y-3 text-zinc-300 leading-relaxed text-sm [&_ul]:space-y-2 [&_ul]:list-none [&_ul>li]:flex [&_ul>li]:gap-2 [&_ul>li]:before:content-['—'] [&_ul>li]:before:text-zinc-600 [&_ul>li]:before:shrink-0">
        {children}
      </div>
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold text-zinc-200 mb-2">{title}</h3>
      {children}
    </div>
  );
}

function Divider() {
  return <hr className="border-zinc-800/70" />;
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
    <div className="mt-3 rounded-lg border border-zinc-800 overflow-hidden">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-zinc-800/60 last:border-0">
              <td className="px-4 py-3 font-medium text-white w-1/4 align-top">{row[0]}</td>
              <td className="px-4 py-3 text-zinc-400 align-top">{row[1]}</td>
              {hasLinks && row[2] && (
                <td className="px-4 py-3 text-right align-top">
                  <a href={row[2]} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-zinc-500 hover:text-[#9147ff] transition-colors">
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
