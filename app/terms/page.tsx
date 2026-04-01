import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/support";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="ft-surface p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-neutral-50">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-6 text-neutral-200">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="space-y-6">
      <section className="ft-surface p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              FantasyTrack
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-neutral-50">Terms of Use</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-300">
              These Terms of Use (&quot;Terms&quot;) govern your access to and use of
              FantasyTrack. By creating an account or participating in contests, you agree to
              be bound by these Terms. This document is a first-pass set of terms intended for
              testing and MVP evaluation and does not replace a final production legal review.
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

      <Section title="Acceptance of terms">
        <p>
          By accessing or using FantasyTrack, you agree to these Terms and our Privacy Policy.
          If you do not agree, you may not use the service.
        </p>
        <p>
          We may update these Terms from time to time. When we do, we will adjust the &quot;last
          updated&quot; date and may provide additional notice within the product.
        </p>
      </Section>

      <Section title="Eligibility">
        <p>
          FantasyTrack is currently offered as a free-to-play fantasy contest environment for
          testing and evaluation purposes. By using the service, you represent that:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>You are at least 18 years old (or the age of majority in your jurisdiction).</li>
          <li>
            You have the legal capacity to enter into a binding agreement with FantasyTrack.
          </li>
          <li>
            You are not prohibited from using fantasy sports products under applicable law.
          </li>
        </ul>
      </Section>

      <Section title="Account responsibilities">
        <p>When you create a FantasyTrack account, you agree that you will:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Provide accurate and up-to-date registration information.</li>
          <li>Maintain the confidentiality of your login credentials.</li>
          <li>
            Be responsible for all activity that occurs under your account, including contest
            entries and use of virtual coins.
          </li>
          <li>Promptly notify us of any suspected unauthorized use of your account.</li>
        </ul>
      </Section>

      <Section title="Contest participation">
        <p>
          FantasyTrack contests are structured as virtual, pool-based fantasy experiences. Each
          contest may have its own rules regarding entry allocation, timing, and scoring, which
          are incorporated into these Terms by reference.
        </p>
        <p>By entering a contest, you agree to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Comply with all posted rules and eligibility requirements.</li>
          <li>Use only one account per person to participate.</li>
          <li>Not attempt to manipulate pools, odds, or outcomes in an unfair manner.</li>
        </ul>
        <p>
          We reserve the right to void entries, adjust results, or take other appropriate
          actions if we detect or suspect abuse, collusion, or rule violations.
        </p>
      </Section>

      <Section title="Virtual coins and no cash value">
        <p>
          FantasyTrack uses virtual coins, points, or similar counters for contest entry and
          scoring. These are provided for entertainment and testing purposes only.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Virtual coins have no cash value and cannot be redeemed for real money.</li>
          <li>
            You may not buy, sell, transfer, or trade virtual coins outside of mechanisms made
            available in the product.
          </li>
          <li>
            Any displayed &quot;winnings&quot; or &quot;payouts&quot; reflect contest performance within
            the product and not real-world financial returns.
          </li>
        </ul>
      </Section>

      <Section title="Acceptable use">
        <p>You agree not to use FantasyTrack to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Engage in any unlawful, harmful, or fraudulent activity.</li>
          <li>Harass, threaten, or abuse other users.</li>
          <li>Reverse engineer, interfere with, or disrupt the service or its security.</li>
          <li>Upload or share content that is defamatory, obscene, or infringing.</li>
          <li>
            Attempt to gain unauthorized access to accounts, data, or systems related to
            FantasyTrack.
          </li>
        </ul>
      </Section>

      <Section title="Intellectual property">
        <p>
          The FantasyTrack name, logo, design system, and underlying software are owned by the
          project maintainers or their licensors and are protected by applicable intellectual
          property laws.
        </p>
        <p>
          You may use the service solely for its intended purpose as a fantasy contest
          environment. You may not copy, modify, distribute, or create derivative works based
          on FantasyTrack without prior written permission, except as otherwise permitted by
          law.
        </p>
      </Section>

      <Section title="Disclaimers">
        <p>
          FantasyTrack is provided on an &quot;as is&quot; and &quot;as available&quot; basis for testing and
          evaluation. To the maximum extent permitted by law, we disclaim all warranties,
          whether express or implied, including but not limited to warranties of merchantability,
          fitness for a particular purpose, and non-infringement.
        </p>
        <p>
          We do not guarantee that contests, odds displays, or settlement processes will be
          error-free, uninterrupted, or fully accurate at all times, particularly in an MVP
          environment.
        </p>
      </Section>

      <Section title="Limitation of liability">
        <p>
          To the maximum extent permitted by law, FantasyTrack and its contributors will not be
          liable for any indirect, incidental, special, consequential, or punitive damages, or
          any loss of profits or revenues, whether incurred directly or indirectly, arising out
          of or in connection with your use of the service.
        </p>
        <p>
          In no event will our total liability for all claims relating to the service exceed the
          greater of: (a) the amount you paid (if any) for access to FantasyTrack in the six
          months preceding the claim, or (b) one hundred U.S. dollars (USD $100).
        </p>
      </Section>

      <Section title="Termination">
        <p>
          We may suspend or terminate your access to FantasyTrack at any time, with or without
          notice, if we reasonably believe you have violated these Terms, are engaging in
          abusive behavior, or are otherwise creating risk for the platform or other users.
        </p>
        <p>
          You may stop using FantasyTrack at any time. Certain provisions of these Terms will
          continue to apply after termination, including those relating to intellectual
          property, disclaimers, and limitations of liability.
        </p>
      </Section>

      <Section title="Contact information">
        <p>
          If you have questions about these Terms or FantasyTrack in general, you can reach us
          at:
        </p>
        <p className="text-sm text-neutral-300">
          <span className="font-semibold text-neutral-50">Email:</span> {SUPPORT_EMAIL}
        </p>
      </Section>
    </div>
  );
}

