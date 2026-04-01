import Link from "next/link";
import { MAX_BET_AMOUNT, MIN_BET_AMOUNT, REQUIRED_TOTAL_WAGER_PER_CONTEST } from "@/lib/constants";
import { formatCoins } from "@/lib/format";

const MAX_WPS_BET_AMOUNT = 30;

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

export default function HowToPlayPage() {
  return (
    <div className="space-y-6">
      <section className="ft-surface p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-50">How to Play</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-300">
              FantasyTrack is a pool-based fantasy contest format where players are treated like a
              race field. You can wager on <span className="font-semibold">WIN</span>,{" "}
              <span className="font-semibold">PLACE</span>, or{" "}
              <span className="font-semibold">SHOW</span>, and estimated payouts move as the pool
              changes.
            </p>
          </div>

          <Link
            href="/"
            className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-neutral-200 transition hover:border-ft-gold/35 hover:text-ft-gold ft-focus-ring"
          >
            Back to contests
          </Link>
        </div>
      </section>

      <Section title="What FantasyTrack is">
        <p>
          Each contest features a field of players, called <span className="font-semibold">lanes</span>.
          You choose a lane and decide how to wager on that player’s finish:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <span className="font-semibold">WIN</span> = your player must finish 1st.
          </li>
          <li>
            <span className="font-semibold">PLACE</span> = your player must finish in the top 2.
          </li>
          <li>
            <span className="font-semibold">SHOW</span> = your player must finish in the top 3.
          </li>
        </ul>
        <p>
          FantasyTrack uses a <span className="font-semibold">pool system</span>, not fixed odds.
          That means payouts are driven by how much money is wagered into each pool.
        </p>
      </Section>

      <Section title="How pricing works">
        <p>
          Each market has its own pool:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>WIN Pool</li>
          <li>PLACE Pool</li>
          <li>SHOW Pool</li>
        </ul>
        <p>
          As more money is wagered on one lane, that lane’s estimated payout usually goes down,
          while other lanes may offer higher estimated payouts.
        </p>
        <p>
          The numbers shown before lock are <span className="font-semibold">estimates</span>. They
          can change as other users continue to wager.
        </p>
        <p>
          Final payouts are determined when the contest locks and is later settled with official
          results.
        </p>
      </Section>

      <Section title="OPEN and LIVE odds">
        <p>
          You may see a lane labeled <span className="font-semibold">OPEN</span> or{" "}
          <span className="font-semibold">LIVE</span>.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <span className="font-semibold">OPEN</span> means no wagers have hit that WIN pool yet,
            so the page is showing the opening estimate.
          </li>
          <li>
            <span className="font-semibold">LIVE</span> means the estimate is now being shaped by
            actual pool activity.
          </li>
        </ul>
        <p>
          When you place a wager, your wager can move the number.
        </p>
      </Section>

      <Section title="Contest allocation rules">
        <p>
          Each contest requires you to allocate exactly{" "}
          <span className="font-semibold">
            {formatCoins(REQUIRED_TOTAL_WAGER_PER_CONTEST)}
          </span>{" "}
          total.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Minimum bet: <span className="font-semibold">{formatCoins(MIN_BET_AMOUNT)}</span>
          </li>
          <li>
            Single-bet max: <span className="font-semibold">{formatCoins(MAX_BET_AMOUNT)}</span>
          </li>
          <li>
            WPS max:{" "}
            <span className="font-semibold">{formatCoins(MAX_WPS_BET_AMOUNT)}</span> per leg
          </li>
          <li>
            All wagers must be placed in <span className="font-semibold">$5 increments</span>
          </li>
        </ul>
        <p>
          On each contest page, you’ll see how much you’ve{" "}
          <span className="font-semibold">wagered</span> and how much is{" "}
          <span className="font-semibold">left to allocate</span>.
        </p>
      </Section>

      <Section title="Scratches and refunds">
  <p>
    If a player is <span className="font-semibold">scratched</span>, that lane remains visible on
    the contest page but is no longer eligible for new wagers.
  </p>
  <ul className="list-disc space-y-2 pl-5">
    <li>Any wagers already placed on a scratched lane are voided and refunded</li>
    <li>Single bets are refunded in full</li>
    <li>WPS wagers are refunded for each affected leg on the scratched lane</li>
    <li>Scratched lanes may appear greyed out or marked with a SCRATCHED tag</li>
  </ul>
  <p>
    If you already met the contest entry requirement before the scratch, your entry remains valid.
    You do <span className="font-semibold">not</span> need to reallocate refunded funds for your
    existing contest entry to count.
  </p>
  <p>
    If time remains before lock, refunded funds may be used to place new wagers, but reallocation
    is optional.
  </p>
</Section>

      <Section title="Settlement and payouts">
        <p>
          After the real-world event is complete, the contest is settled by entering final ranks and,
          where applicable, fantasy points.
        </p>
        <p>
          Once a contest is settled:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Winning tickets receive payouts</li>
          <li>Your profile updates with settlement and transaction history</li>
          <li>The contest becomes view-only for users</li>
        </ul>
        <p>
          Admins can reopen a settled contest if a correction is needed, then resettle it with the
          correct results.
        </p>
      </Section>

      <Section title="Important rules">
        <ul className="list-disc space-y-2 pl-5">
          <li>All wagers are final once placed</li>
          <li>No edits or refunds after submission</li>
          <li>Contests must be open to accept wagers</li>
          <li>You must follow contest allocation and wager-size rules</li>
          <li>Payout displays before lock are estimates, not guarantees</li>
        </ul>
      </Section>

      <Section title="Where to see everything">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <span className="font-semibold">Contest page</span>: pools, odds, bet slip, and your bets
          </li>
          <li>
            <span className="font-semibold">Profile</span>: balance, ticket history, and transaction history
          </li>
          <li>
            <span className="font-semibold">Series leaderboard</span>: standings across a full series
          </li>
        </ul>
      </Section>
    </div>
  );
}