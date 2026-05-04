import Link from "next/link";
import { Logo } from "@/components/Logo";

export const metadata = {
  title: "Terms of Service — Collab Planner",
  description: "Terms of Service for Collab Planner: who can use it, acceptable use, third-party platform compliance, disclaimers, and dispute resolution.",
};

const LAST_UPDATED = "May 4, 2026";
const CONTACT_EMAIL = "deutschmarkonline@gmail.com";
const APP_URL = "https://collab.deutschmark.online";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href={APP_URL} className="flex items-center text-muted-foreground hover:text-foreground transition-colors">
            <Logo width={108} height={60} />
          </Link>
          <nav className="flex items-center gap-4 text-xs text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <span className="text-foreground font-medium">Terms of Service</span>
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
          <h1 className="text-4xl font-bold mb-3">Terms of Service</h1>
          <p className="text-muted-foreground text-sm">Last updated: {LAST_UPDATED}</p>
          <p className="mt-4 leading-relaxed">
            These Terms govern your access to and use of Collab Planner (&ldquo;the Service&rdquo;).
            By signing in with Twitch or otherwise using the Service, you agree to these Terms. If
            you do not agree, do not use the Service.
          </p>
          <p className="mt-3 leading-relaxed text-muted-foreground text-sm">
            The Service is operated globally. Application infrastructure is hosted on Vercel, with
            data persisted in Supabase Postgres, both in US regions. See the{" "}
            <Link href="/privacy" className="text-[#9147ff] hover:underline">Privacy Policy</Link>{" "}
            for data flows, retention, and your rights.
          </p>
        </div>

        <div className="space-y-10">

          <Section id="acceptance" title="1. Acceptance and Eligibility">
            <p>By accessing or using the Service, you confirm that:</p>
            <ul>
              <li>You are at least 13 years old (Twitch&rsquo;s minimum age) and have legal capacity to agree to these Terms in your jurisdiction. If you are between 13 and the age of majority where you live, a parent or guardian has consented.</li>
              <li>You hold a valid Twitch account in good standing and your use complies with the Twitch Terms of Service and Community Guidelines.</li>
              <li>You are not on a sanctions list or otherwise prohibited from using US-based services.</li>
            </ul>
          </Section>

          <Divider />

          <Section id="service" title="2. Description of Service">
            <p>
              Collab Planner is a web application that helps Twitch streamers schedule, coordinate,
              and plan collaborative livestream events with other streamers. Features include
              schedule analysis, friend lists, collab event planning, optional Discord
              notifications via incoming webhooks, and a public Twitch panel extension.
            </p>
            <p>
              The Service is operated independently and is not affiliated with, endorsed by, or
              sponsored by Twitch Interactive, Inc., Discord Inc., or any third-party platform. It
              is provided as a free, community-supported service. There is no SLA or guaranteed
              uptime — features ship, change, and occasionally retire as the product evolves.
            </p>
          </Section>

          <Divider />

          <Section id="account" title="3. Account and Twitch Login">
            <p>
              Your Collab Planner account is created automatically when you sign in with Twitch
              OAuth via Supabase Auth. You are responsible for keeping your Twitch credentials
              secure; we are not liable for loss resulting from unauthorized access to that
              third-party account.
            </p>
            <p className="mt-3">
              If your Twitch account is suspended, banned, or deleted, your Collab Planner access
              tied to that account ends with it. We may suspend or terminate access at any time
              for violations of these Terms, abuse, or to protect the Service or other users.
            </p>
            <p className="mt-3">
              You may request account deletion at any time by emailing{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#9147ff] hover:underline">{CONTACT_EMAIL}</a>.
              Deletion is permanent — see the Privacy Policy for retention specifics.
            </p>
          </Section>

          <Divider />

          <Section id="acceptable-use" title="4. Acceptable Use">
            <p>You agree not to use the Service to:</p>
            <ul>
              <li>Violate any applicable law or regulation.</li>
              <li>Harass, defame, threaten, or harm other users or third parties.</li>
              <li>Scrape, crawl, or harvest data from the Service in an automated manner beyond the documented APIs and your own account&rsquo;s data.</li>
              <li>Attempt unauthorized access to other accounts, our infrastructure, or third-party platforms via the Service (including credential stuffing, token forgery, or rate-limit evasion).</li>
              <li>Use the Twitch panel extension to display false, misleading, fraudulent, or harmful content.</li>
              <li>Post spam, unsolicited promotional content, or harassment to Discord channels via the Service&rsquo;s notification feature.</li>
              <li>Abuse the Twitch or Discord APIs in ways that violate their terms or jeopardize the Service&rsquo;s API standing.</li>
              <li>Probe for vulnerabilities other than coordinated, good-faith disclosure to the contact email below.</li>
              <li>Use the Service for any purpose that&rsquo;s illegal in your jurisdiction or in the United States.</li>
            </ul>
          </Section>

          <Divider />

          <Section id="content" title="5. Your Content and License">
            <p>
              Content you create in the Service — such as event titles, dates, descriptions, friend
              notes, and collab plans (&ldquo;Your Content&rdquo;) — remains yours. By creating it,
              you grant us a worldwide, non-exclusive, royalty-free license to host, store,
              transmit, and display it solely as needed to operate the Service for you and your
              chosen collaborators.
            </p>
            <p className="mt-3">
              You are responsible for Your Content, including the accuracy of friend lists, event
              metadata you publish to participants, and notifications dispatched on your behalf to
              Discord channels you have authority to post in.
            </p>
          </Section>

          <Divider />

          <Section id="third-party" title="6. Third-Party Platform Compliance">
            <p>
              When using Collab Planner you must also comply with the terms of connected
              third-party platforms. The Service connects to the platforms below; their terms
              continue to apply when you use features that touch them.
            </p>
            <Table rows={[
              ["Twitch", "Terms of Service", "https://www.twitch.tv/p/legal/terms-of-service/"],
              ["Twitch", "Community Guidelines", "https://www.twitch.tv/p/legal/community-guidelines/"],
              ["Discord", "Terms of Service", "https://discord.com/terms"],
              ["Discord", "Developer Terms", "https://discord.com/developers/docs/policies-and-agreements/developer-terms-of-service"],
            ]} hasLinks />
            <p className="mt-4">
              We reserve the right to suspend or terminate your access if your use of the Service
              results in violations of third-party platform policies that affect the
              Service&rsquo;s API access or standing.
            </p>
          </Section>

          <Divider />

          <Section id="availability" title="7. Service Availability">
            <p>
              We aim to keep the Service available and reliable, but we do not guarantee
              uninterrupted access. The Service may be unavailable due to maintenance, third-party
              outages (Twitch, Discord, Supabase, Vercel), or circumstances outside our control.
            </p>
            <p className="mt-3">
              We reserve the right to modify, suspend, or discontinue any part of the Service at
              any time, with reasonable advance notice where practicable.
            </p>
          </Section>

          <Divider />

          <Section id="disclaimers" title="8. Disclaimers">
            <p>
              The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without
              warranty of any kind, express or implied, including but not limited to warranties of
              merchantability, fitness for a particular purpose, non-infringement, accuracy, or
              uninterrupted service.
            </p>
            <p className="mt-3">
              The Service depends on third-party platforms (Twitch, Discord, Supabase, Vercel) for
              substantial portions of its functionality. We do not warrant the continuous
              availability of those services or that integrations with them will remain stable as
              those services evolve. Some jurisdictions do not allow the exclusion of certain
              warranties; in those jurisdictions, the exclusions in this section apply to the
              maximum extent permitted by law.
            </p>
          </Section>

          <Divider />

          <Section id="liability" title="9. Limitation of Liability">
            <p>
              To the maximum extent permitted by applicable law, Collab Planner and its operator
              are not liable for any indirect, incidental, special, consequential, or punitive
              damages, or for any loss of profits, revenue, data, goodwill, or stream
              opportunities, arising from your use of or inability to use the Service.
            </p>
            <p className="mt-3">
              Total aggregate liability for any claim arising out of or related to these Terms or
              the Service is limited to the greater of (a) the amount you paid us in the twelve
              months preceding the claim, or (b) USD $50. The Service is currently free, so this
              cap is generally USD $50.
            </p>
            <p className="mt-3 text-muted-foreground text-sm">
              Some jurisdictions do not allow limitations on certain damages; in those
              jurisdictions, liability is limited to the smallest amount permitted by law.
            </p>
          </Section>

          <Divider />

          <Section id="indemnification" title="10. Indemnification">
            <p>
              You agree to indemnify and hold harmless Collab Planner and its operator from any
              claim, demand, loss, liability, or expense (including reasonable attorneys&rsquo;
              fees) arising from:
            </p>
            <ul>
              <li>Your use of the Service in violation of these Terms or applicable law.</li>
              <li>Your violation of a third-party platform&rsquo;s terms while using the Service (e.g., Twitch ToS, Discord Developer Terms).</li>
              <li>Notifications dispatched on your behalf to Discord channels you did not have authority to post in.</li>
              <li>Unauthorized access to your account through credentials you failed to keep secure.</li>
            </ul>
          </Section>

          <Divider />

          <Section id="termination" title="11. Termination">
            <p>
              You may terminate your use of the Service at any time by signing out, disconnecting
              third-party services from Settings, and emailing the contact address below to
              request account deletion (see the Privacy Policy for retention specifics).
            </p>
            <p className="mt-3">
              We may suspend or terminate your access at any time for violations of these Terms,
              abuse of the Service, when required to comply with Twitch enforcement actions or
              applicable law, or to protect the Service or other users. Where reasonable, you will
              be given notice and an opportunity to cure.
            </p>
            <p className="mt-3">
              Sections that by their nature should survive termination — including Your Content
              license to the extent needed to provide service to you up to termination,
              disclaimers, limitation of liability, indemnification, and dispute resolution —
              survive.
            </p>
          </Section>

          <Divider />

          <Section id="modifications" title="12. Modifications to the Service">
            <p>
              The Service is actively developed. Features may be added, changed, deprecated, or
              removed over time. These Terms may be updated to reflect changes to the Service, the
              law, or operational practices. The &ldquo;Last updated&rdquo; date above reflects
              the most recent revision. Continued use after a Terms update means the updated
              Terms apply to your use of the Service.
            </p>
          </Section>

          <Divider />

          <Section id="governing-law" title="13. Governing Law and Disputes">
            <p>
              These Terms are governed by the laws of the State of New York, United States,
              without regard to its conflict-of-laws principles. The United Nations Convention on
              Contracts for the International Sale of Goods does not apply.
            </p>
            <p className="mt-3">
              Any dispute arising out of or related to these Terms or your use of the Service will
              be resolved in the state or federal courts located in New York County, New York, and
              you consent to the exclusive jurisdiction and venue of those courts. This does not
              deprive you of any consumer protections that apply in your country of residence and
              that cannot be waived by contract.
            </p>
          </Section>

          <Divider />

          <Section id="misc" title="14. Miscellaneous">
            <SubSection title="14.1 Severability">
              <p className="text-sm leading-relaxed">
                If any provision of these Terms is held unenforceable, that provision will be
                modified only to the minimum extent necessary, and the remaining provisions remain
                in full force.
              </p>
            </SubSection>
            <SubSection title="14.2 Entire agreement">
              <p className="text-sm leading-relaxed">
                These Terms, together with the{" "}
                <Link className="text-[#9147ff] hover:underline" href="/privacy">Privacy Policy</Link>,
                constitute the entire agreement between you and Collab Planner regarding the
                Service and supersede any prior agreements on the same subject.
              </p>
            </SubSection>
            <SubSection title="14.3 No waiver">
              <p className="text-sm leading-relaxed">
                Failure to enforce any provision is not a waiver of the right to enforce it later.
              </p>
            </SubSection>
            <SubSection title="14.4 Assignment">
              <p className="text-sm leading-relaxed">
                You may not assign these Terms without prior written consent. We may assign these
                Terms in connection with a merger, acquisition, or sale of substantially all
                assets, with reasonable notice to you.
              </p>
            </SubSection>
          </Section>

          <Divider />

          <Section id="contact" title="15. Contact">
            <p>
              Questions about these Terms, account suspensions, or other legal matters:{" "}
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
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <span className="text-foreground">Terms of Service</span>
            <Link href="/" className="hover:text-foreground transition-colors">Back to App</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}

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
                    Read ↗
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
