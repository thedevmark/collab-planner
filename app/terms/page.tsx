import Link from "next/link";

export const metadata = {
  title: "Terms of Service — Collab Planner",
  description: "Terms and conditions for using Collab Planner.",
};

const LAST_UPDATED = "March 25, 2026";
const CONTACT_EMAIL = "legal@deutschmark.online";
const APP_URL = "https://collab.deutschmark.online";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#09030f] text-zinc-200">

      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-800/60 bg-[#09030f]/90 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href={APP_URL} className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 transition-colors">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="" width={45} height={30} style={{ imageRendering: "pixelated" }} />
            <span className="text-sm font-semibold text-zinc-200">Collab Planner</span>
          </Link>
          <nav className="flex items-center gap-4 text-xs text-zinc-500">
            <Link href="/privacy" className="hover:text-zinc-300 transition-colors">Privacy Policy</Link>
            <span className="text-zinc-300 font-medium">Terms of Service</span>
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
          <h1 className="text-4xl font-bold text-white mb-3">Terms of Service</h1>
          <p className="text-zinc-400 text-sm">Last updated: {LAST_UPDATED}</p>
          <p className="mt-4 text-zinc-300 leading-relaxed">
            These Terms of Service govern your access to and use of Collab Planner
            (&ldquo;the Service&rdquo;). By using the Service you agree to these terms.
            Please read them carefully.
          </p>
        </div>

        <div className="space-y-10">

          <Section id="service" title="1. The Service">
            <p>
              Collab Planner is a web application that helps Twitch streamers schedule,
              coordinate, and plan collaborative livestream events with other streamers.
              Features include stream schedule analysis, collab event planning, Discord
              notifications, and a public Twitch panel extension.
            </p>
            <p>
              The Service is operated independently and is not affiliated with, endorsed by,
              or sponsored by Twitch Interactive, Inc. or Discord Inc.
            </p>
          </Section>

          <Divider />

          <Section id="eligibility" title="2. Eligibility">
            <ul>
              <li>You must have a valid Twitch account to use the Service</li>
              <li>You must be at least 13 years old, consistent with Twitch&rsquo;s minimum age requirement</li>
              <li>By connecting your Discord account, you confirm you comply with Discord&rsquo;s Terms of Service</li>
              <li>You must have authority to post in any Discord server you connect to the Service</li>
            </ul>
          </Section>

          <Divider />

          <Section id="account" title="3. Your Account">
            <p>
              Your Collab Planner account is created automatically when you log in via Twitch OAuth.
              You are responsible for maintaining the security of your Twitch account and any
              connected Discord account. We are not liable for any loss resulting from unauthorized
              access to those third-party accounts.
            </p>
            <p className="mt-3">
              You may delete your account at any time by contacting us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#9147ff] hover:underline">
                {CONTACT_EMAIL}
              </a>.
              Account deletion is permanent and irreversible.
            </p>
          </Section>

          <Divider />

          <Section id="acceptable-use" title="4. Acceptable Use">
            <p>You agree not to use the Service to:</p>
            <ul>
              <li>Violate any applicable law or regulation</li>
              <li>Harass, abuse, or harm other users or third parties</li>
              <li>Scrape, crawl, or harvest data from the Service in an automated manner</li>
              <li>Attempt to gain unauthorized access to other accounts or our infrastructure</li>
              <li>Use the Twitch panel extension to display false, misleading, or harmful content</li>
              <li>Post spam or unsolicited promotional content to Discord channels via the Service</li>
              <li>Circumvent rate limits or abuse the Twitch or Discord APIs in ways that violate their policies</li>
            </ul>
          </Section>

          <Divider />

          <Section id="third-party" title="5. Third-Party Platform Compliance">
            <p>
              When using Collab Planner you must also comply with the terms of connected
              third-party platforms:
            </p>
            <div className="mt-3 rounded-lg border border-zinc-800 overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  {[
                    ["Twitch", "Terms of Service", "https://www.twitch.tv/p/legal/terms-of-service"],
                    ["Discord", "Terms of Service", "https://discord.com/terms"],
                  ].map(([name, label, href]) => (
                    <tr key={name} className="border-b border-zinc-800/60 last:border-0">
                      <td className="px-4 py-3 font-medium text-white w-1/4">{name}</td>
                      <td className="px-4 py-3 text-zinc-400">{label}</td>
                      <td className="px-4 py-3 text-right">
                        <a href={href} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-zinc-500 hover:text-[#9147ff] transition-colors">
                          Read ↗
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4">
              We reserve the right to suspend or terminate your account if your use of the
              Service results in violations of third-party platform policies that affect the
              Service&rsquo;s API access or standing.
            </p>
          </Section>

          <Divider />

          <Section id="content" title="6. Your Content">
            <p>
              Content you create in the Service — such as event titles, notes, and descriptions —
              remains yours. By submitting content you grant us a limited license to store and
              display it to operate the Service. We do not claim ownership of your content and
              will not use it beyond what is necessary to provide the Service.
            </p>
          </Section>

          <Divider />

          <Section id="availability" title="7. Service Availability">
            <p>
              We aim to keep the Service available and reliable, but we do not guarantee
              uninterrupted access. The Service may be unavailable due to maintenance, third-party
              API outages (Twitch, Discord), or circumstances beyond our control.
            </p>
            <p className="mt-3">
              We reserve the right to modify, suspend, or discontinue the Service or any feature
              at any time with reasonable notice where practicable.
            </p>
          </Section>

          <Divider />

          <Section id="disclaimers" title="8. Disclaimers">
            <div className="rounded-lg bg-zinc-900/60 border border-zinc-800 px-5 py-4 text-zinc-400 text-xs leading-relaxed uppercase tracking-wide">
              The service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without
              warranties of any kind, express or implied, including but not limited to warranties
              of merchantability, fitness for a particular purpose, or non-infringement.
              We do not warrant that the service will be error-free, secure, or continuously
              available.
            </div>
          </Section>

          <Divider />

          <Section id="liability" title="9. Limitation of Liability">
            <div className="rounded-lg bg-zinc-900/60 border border-zinc-800 px-5 py-4 text-zinc-400 text-xs leading-relaxed uppercase tracking-wide">
              To the fullest extent permitted by law, Collab Planner and its operators shall not
              be liable for any indirect, incidental, special, consequential, or punitive damages
              arising from your use of or inability to use the service, including loss of data,
              revenue, or reputation.
            </div>
          </Section>

          <Divider />

          <Section id="indemnification" title="10. Indemnification">
            <p>
              You agree to indemnify and hold harmless Collab Planner and its operators from any
              claims, damages, or expenses (including reasonable legal fees) arising from your
              use of the Service, your violation of these Terms, or your violation of any
              third-party rights.
            </p>
          </Section>

          <Divider />

          <Section id="changes" title="11. Changes to These Terms">
            <p>
              We may update these Terms to reflect changes in the Service, legal requirements,
              or our policies. Material changes will be communicated by updating the
              &ldquo;Last updated&rdquo; date above. Continued use of the Service after the
              effective date of changes constitutes your acceptance of the revised Terms.
            </p>
          </Section>

          <Divider />

          <Section id="governing-law" title="12. Governing Law">
            <p>
              These Terms are governed by and construed in accordance with applicable law.
              Any disputes arising from these Terms or the Service shall be resolved through
              good-faith negotiation first. If unresolved, disputes shall be subject to binding
              arbitration or small claims court at our election.
            </p>
          </Section>

          <Divider />

          <Section id="contact" title="13. Contact">
            <p>
              Questions about these Terms:{" "}
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="" width={36} height={24} style={{ imageRendering: "pixelated" }} />
            <span>Collab Planner</span>
            <span className="text-zinc-700">·</span>
            <span>{new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-5 text-xs text-zinc-500">
            <Link href="/privacy" className="hover:text-zinc-300 transition-colors">Privacy Policy</Link>
            <span className="text-zinc-400">Terms of Service</span>
            <Link href="/" className="hover:text-zinc-300 transition-colors">Back to App</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}

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

function Divider() {
  return <hr className="border-zinc-800/70" />;
}
