import { getGlobalLeaderboard } from "@/lib/market";
import { formatCoins } from "@/lib/format";
import { resolvePrimaryBadgeForLeaderboard } from "@/lib/badges";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LeaderboardPage() {
  const rows = await getGlobalLeaderboard(false);
  const entries = rows.map((row) => ({
    ...row,
    primaryBadge: resolvePrimaryBadgeForLeaderboard(row),
  }));

  return (
    <div className="space-y-6">
      {/* Page header */}
      <section className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-4 shadow-sm">
        <h1 className="text-xl font-semibold text-neutral-50">Leaderboard</h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-400">
          Global FantasyTrack rankings, ordered by Skill Score. Skill Score blends ROI, winning
          contest rate, consistency, and qualifying volume so the board highlights who truly reads
          the market well.
        </p>
      </section>

      {/* Full leaderboard table */}
      <section className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-4 shadow-sm">
        {entries.length === 0 ? (
          <p className="text-sm text-neutral-400">No entries yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-neutral-800 text-neutral-400">
                <tr>
                  <th className="py-2 pr-4">Rank</th>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Skill Score</th>
                  <th className="py-2 pr-4">ROI</th>
                  <th className="py-2 pr-4">Winning Contest %</th>
                  <th className="py-2 pr-4">Contests</th>
                  <th className="py-2 pr-4">Wagered</th>
                  <th className="py-2">Eligibility</th>
                </tr>
              </thead>
              <tbody className="text-neutral-100">
                {entries.map((row) => (
                  <tr
                    key={row.userId}
                    className="border-b border-neutral-800/70 hover:bg-neutral-900/70"
                  >
                    <td className="py-2 pr-4 tabular-nums">{row.rank}</td>
                    <td className="py-2 pr-4">
                      <span className="font-medium text-neutral-50">{row.displayName}</span>{" "}
                      {row.primaryBadge ? (
                        <span className="ml-1 inline-flex items-center rounded-full border border-amber-400/70 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-100">
                          {row.primaryBadge.label}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-4 tabular-nums">
                      {row.skillScore.toFixed(1)}
                    </td>
                    <td className="py-2 pr-4 tabular-nums">
                      {(row.roi * 100).toFixed(1)}%
                    </td>
                    <td className="py-2 pr-4 tabular-nums">
                      {(row.podiumRate * 100).toFixed(1)}%
                    </td>
                    <td className="py-2 pr-4 tabular-nums">
                      {row.settledContests}
                    </td>
                    <td className="py-2 pr-4 tabular-nums">
                      {formatCoins(row.totalWagered)}
                    </td>
                    <td className="py-2">
                      {row.eligible ? (
                        <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">
                          Eligible
                        </span>
                      ) : (
                        <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
                          Not eligible
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
