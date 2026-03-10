"use client";

import { useState } from "react";
import { formatCoins, formatDateTime } from "@/lib/format";
import { TransactionType } from "@prisma/client";

type TicketHistoryProps = {
  tickets: any[];
};

const INITIAL_VISIBLE = 5;

export default function ProfileTicketHistory({ tickets }: TicketHistoryProps) {
  const [expanded, setExpanded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

  const hasTickets = tickets.length > 0;
  const visibleTickets = expanded ? tickets.slice(0, visibleCount) : [];
  const hasMore = tickets.length > visibleCount;

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/80 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-neutral-50">Ticket history</h2>
          <p className="mt-1 text-xs text-neutral-400">
            View your recent bets. Older history will be grouped and filterable by contest or series in
            future updates.
          </p>
        </div>

        {hasTickets ? (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="rounded-full border border-neutral-700 bg-neutral-950 px-3 py-1 text-xs font-semibold text-neutral-200 hover:border-amber-300 hover:text-amber-200"
          >
            {expanded ? "Collapse" : "Show recent tickets"}
          </button>
        ) : null}
      </div>

      {!hasTickets ? (
        <p className="mt-3 text-sm text-neutral-400">No tickets yet.</p>
      ) : null}

      {expanded && visibleTickets.length > 0 ? (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm text-neutral-100">
              <thead className="bg-neutral-900 text-[11px] uppercase tracking-wide text-neutral-400">
                <tr>
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Contest</th>
                  <th className="px-3 py-2">Legs</th>
                  <th className="px-3 py-2">Total wager</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Result</th>
                  <th className="px-3 py-2">Settlement</th>
                </tr>
              </thead>
              <tbody>
                {visibleTickets.map((t: any) => {
                  const settlement = t.netAmount ?? null;

                  return (
                    <tr
                      key={t.id}
                      className="border-t border-neutral-800/70 align-top hover:bg-neutral-900/70"
                    >
                      <td className="px-3 py-2 text-sm text-neutral-300">
                        {formatDateTime(new Date(t.placedAt))}
                      </td>
                      <td className="px-3 py-2 text-sm text-neutral-100">
                        {t.contest?.title ?? "—"}
                      </td>

                      <td className="px-3 py-2 text-sm text-neutral-100">
                        <details className="group">
                          <summary className="cursor-pointer select-none text-xs text-amber-200/80 underline underline-offset-2 hover:text-amber-200">
                            {t.legs.length} leg{t.legs.length === 1 ? "" : "s"}
                          </summary>

                          <div className="mt-2 rounded border border-neutral-800 bg-neutral-950/80 p-2">
                            <table className="w-full text-sm">
                              <thead className="text-[11px] uppercase tracking-wide text-neutral-400">
                                <tr>
                                  <th className="py-1 pr-2 text-left">Lane</th>
                                  <th className="py-1 pr-2 text-left">Team</th>
                                  <th className="py-1 pr-2 text-left">Pos</th>
                                  <th className="py-1 pr-2 text-left">Market</th>
                                  <th className="py-1 pr-2 text-left">Wager amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {t.legs.map((leg: any) => {
                                  const refunded =
                                    leg.isVoided ||
                                    leg.result === "VOID" ||
                                    leg.lane?.status === "SCRATCHED";

                                  const betTx =
                                    leg.transactions?.find(
                                      (tx: any) => tx.type === TransactionType.BET
                                    ) ?? leg.transactions?.[0];

                                  return (
                                    <tr
                                      key={leg.id}
                                      className={[
                                        "border-t border-neutral-800",
                                        refunded ? "bg-red-500/5" : "",
                                      ].join(" ")}
                                    >
                                      <td className="py-1 pr-2">
                                        <div className="flex items-center gap-2">
                                          <span
                                            className={
                                              refunded ? "text-neutral-500 line-through" : ""
                                            }
                                          >
                                            {leg.lane?.name ?? leg.laneNameSnap ?? "—"}
                                          </span>
                                          {refunded ? (
                                            <span className="rounded border border-red-400/70 bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-300">
                                              Refunded
                                            </span>
                                          ) : null}
                                        </div>
                                      </td>
                                      <td className="py-1 pr-2 text-sm text-neutral-300">
                                        {leg.lane?.team ?? leg.teamSnap ?? "—"}
                                      </td>
                                      <td className="py-1 pr-2 text-sm text-neutral-300">
                                        {leg.lane?.position ?? leg.positionSnap ?? "—"}
                                      </td>
                                      <td className="py-1 pr-2 text-sm text-neutral-200">
                                        {leg.market}
                                      </td>
                                      <td className="py-1 pr-2 text-sm text-neutral-100">
                                        <span
                                          className={
                                            refunded ? "text-neutral-500 line-through" : ""
                                          }
                                        >
                                          {formatCoins(Math.abs(betTx?.amount ?? 0))}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </details>
                      </td>

                      <td className="px-3 py-2 text-sm text-neutral-100">
                        {formatCoins(
                          t.legs.reduce((sum: number, leg: any) => {
                            const betTx =
                              leg.transactions?.find(
                                (tx: any) => tx.type === TransactionType.BET
                              ) ?? leg.transactions?.[0];
                            return sum + Math.abs(betTx?.amount ?? 0);
                          }, 0)
                        )}
                      </td>

                      <td className="px-3 py-2 text-sm text-neutral-200">{t.status}</td>
                      <td className="px-3 py-2 text-sm text-neutral-200">
                        {t.result ?? "—"}
                      </td>

                      <td
                        className={`px-3 py-2 text-sm ${
                          settlement == null
                            ? "text-neutral-500"
                            : settlement >= 0
                              ? "text-emerald-300"
                              : "text-red-300"
                        }`}
                      >
                        {settlement == null
                          ? "—"
                          : settlement > 0
                            ? `+${formatCoins(settlement)}`
                            : formatCoins(settlement)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-2 text-xs text-neutral-500">
            Settlement will show after contests are settled (admin). For now, tickets will show total
            wager + legs.
          </p>

          <div className="mt-3 flex items-center justify-end gap-2">
            {hasMore ? (
              <button
                type="button"
                onClick={() =>
                  setVisibleCount((current) =>
                    Math.min(current + INITIAL_VISIBLE, tickets.length)
                  )
                }
                className="rounded-full border border-neutral-700 bg-neutral-950 px-3 py-1 text-xs font-semibold text-neutral-200 hover:border-amber-300 hover:text-amber-200"
              >
                Show more
              </button>
            ) : null}
            {visibleCount > INITIAL_VISIBLE ? (
              <button
                type="button"
                onClick={() => setVisibleCount(INITIAL_VISIBLE)}
                className="rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1 text-xs font-semibold text-neutral-300 hover:border-neutral-500 hover:text-neutral-100"
              >
                Show less
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}

