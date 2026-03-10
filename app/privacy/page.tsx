import Link from "next/link";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/80 p-5">
      <h2 className="text-lg font-semibold text-neutral-50">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-6 text-neutral-200">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/80 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              FantasyTrack
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-neutral-50">Privacy Policy</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-300">
              This Privacy Policy describes how FantasyTrack collects, uses, and protects
              information in connection with our free-to-play fantasy contest experience.
              This document is a first-pass policy intended for testing and MVP evaluation
              and does not replace a final production legal review.
            </p>
          </div>

          <Link
            href="/"
            className="rounded border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:border-amber-300 hover:text-amber-200"
          >
            Back to contests
          </Link>
        </div>
      </section>

      <Section title="Information we collect">
        <p>We collect the following categories of information when you use FantasyTrack:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <span className="font-semibold text-neutral-100">Account details</span>, such as
            your display name, email address, and phone number.
          </li>
          <li>
            <span className="font-semibold text-neutral-100">Usage information</span>, such as
            pages you visit, contests you view, and actions you take in the product.
          </li>
          <li>
            <span className="font-semibold text-neutral-100">Contest activity</span>, including
            tickets you create, wagers you place with virtual coins, and your results.
          </li>
          <li>
            <span className="font-semibold text-neutral-100">Technical information</span>, such
            as browser type, device identifiers, IP address, and approximate location derived
            from your IP address.
          </li>
        </ul>
        <p>
          We do not knowingly collect sensitive categories of data such as government IDs or
          payment card numbers as part of this MVP environment.
        </p>
      </Section>

      <Section title="How we use information">
        <p>We use the information we collect to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Operate, maintain, and improve the FantasyTrack product and features.</li>
          <li>Authenticate users and secure access to contests and profile data.</li>
          <li>Track contest entries, leaderboards, and virtual coin balances.</li>
          <li>Monitor system health and diagnose technical issues.</li>
          <li>
            Analyze usage in aggregate to inform product design, testing, and roadmap
            decisions.
          </li>
        </ul>
        <p>
          We may also use limited information for internal testing and evaluation of new
          functionality, always in line with this Policy.
        </p>
      </Section>

      <Section title="Cookies and analytics">
        <p>
          FantasyTrack may use cookies, local storage, or similar technologies to remember
          your session, keep you signed in, and measure how the product is used.
        </p>
        <p>
          We may use analytics tools to collect aggregated, de-identified information about
          visits and interactions (for example, which pages are most frequently viewed). We
          do not use this data to show ads or sell it to third parties in this MVP
          environment.
        </p>
        <p>
          You can manage cookies at the browser level, but disabling certain cookies may
          impact your ability to sign in or participate in contests.
        </p>
      </Section>

      <Section title="Account information">
        <p>
          You are responsible for maintaining accurate account information, including your
          email address and display name. You can update some details directly from your
          profile page.
        </p>
        <p>
          If you would like to request changes that are not available through the interface,
          you can contact us using the information at the end of this Policy.
        </p>
      </Section>

      <Section title="Communications">
        <p>
          We may use your contact information to send you transactional communications (for
          example, important updates about contests, account changes, or platform notices).
        </p>
        <p>
          At this MVP stage, FantasyTrack does not send marketing email campaigns, but we may
          add that capability in the future with appropriate consent and controls.
        </p>
      </Section>

      <Section title="Data retention">
        <p>
          We retain account and contest information for as long as it is reasonably necessary
          to operate the platform, maintain accurate contest history, and satisfy legitimate
          testing and product-development needs.
        </p>
        <p>
          We may retain aggregated or de-identified data for analytics and product research
          purposes beyond the life of an individual account.
        </p>
      </Section>

      <Section title="Security">
        <p>
          We use reasonable technical and organizational measures to help protect information
          against accidental or unlawful access, loss, misuse, or alteration. No system can
          be completely secure, and we cannot guarantee absolute security.
        </p>
        <p>
          You are responsible for maintaining the security of your own login credentials and
          devices.
        </p>
      </Section>

      <Section title="Changes to this Policy">
        <p>
          Because FantasyTrack is in active development, we may update this Privacy Policy
          from time to time. When we make material changes, we will adjust the “last updated”
          date and may provide additional notice within the product.
        </p>
      </Section>

      <Section title="Contact information">
        <p>
          If you have questions about this Privacy Policy or how FantasyTrack handles your
          information, you can reach us at:
        </p>
        <p className="text-sm text-neutral-300">
          <span className="font-semibold text-neutral-50">Email:</span>{" "}
          support@fantasytrack.test
        </p>
      </Section>
    </div>
  );
}

