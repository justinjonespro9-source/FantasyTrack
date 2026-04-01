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

export default function DisclaimerPage() {
  return (
    <div className="space-y-6">
      <section className="ft-surface p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              FantasyTrack
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-neutral-50">Disclaimer</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-300">
              FantasyTrack is an experimental, free-to-play fantasy contest environment. This
              Disclaimer explains important limitations and notices relating to your use of the
              platform.
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

      <Section title="No real-money gambling">
        <p>
          FantasyTrack uses virtual coins or points for contest entry and scoring. These have no
          cash value and cannot be redeemed for real-world money, prizes, or other monetary
          equivalents.
        </p>
        <p>
          Any &quot;winnings&quot;, &quot;payouts&quot;, or leaderboards shown in the product reflect contest
          performance in a simulated environment only.
        </p>
      </Section>

      <Section title="Not financial or betting advice">
        <p>
          Information shown within FantasyTrack, including odds estimates, pools, or performance
          metrics, is provided for entertainment and product-evaluation purposes only. Nothing in
          the product should be interpreted as financial advice, betting advice, or a
          recommendation to engage in real-money wagering.
        </p>
      </Section>

      <Section title="No guarantee of accuracy">
        <p>
          While we aim to provide a smooth experience, FantasyTrack is in active development. We do
          not guarantee that scoring, odds displays, contest outcomes, or settlement processes will
          be error-free, uninterrupted, or fully accurate at all times.
        </p>
        <p>
          Bugs, outages, or data issues may occur as part of this MVP environment. We may adjust,
          recalculate, or reset contests to address issues discovered during testing.
        </p>
      </Section>

      <Section title="Local laws and eligibility">
        <p>
          You are responsible for understanding and complying with any laws or regulations that
          apply to your use of fantasy contests in your jurisdiction. By using FantasyTrack, you
          represent that you are eligible to participate in fantasy sports offerings where you live.
        </p>
      </Section>

      <Section title="Third-party links and content">
        <p>
          FantasyTrack may link to third-party websites, services, or content for informational or
          illustrative purposes. We do not control or endorse those third parties and are not
          responsible for their content, terms, or privacy practices.
        </p>
      </Section>

      <Section title="Changes to this Disclaimer">
        <p>
          We may update this Disclaimer from time to time as FantasyTrack evolves. When we make
          material changes, we will adjust the &quot;last updated&quot; date and may provide additional
          notice within the product.
        </p>
      </Section>

      <Section title="Contact information">
        <p>
          If you have questions about this Disclaimer or how it applies to your use of
          FantasyTrack, you can reach us at:
        </p>
        <p className="text-sm text-neutral-300">
          <span className="font-semibold text-neutral-50">Email:</span> {SUPPORT_EMAIL}
        </p>
      </Section>
    </div>
  );
}

