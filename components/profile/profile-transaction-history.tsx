"use client";

import { useState } from "react";
import { formatCoins, formatDateTime } from "@/lib/format";
import { TransactionType } from "@prisma/client";

type TransactionHistoryProps = {
  transactions: any[];
};

const INITIAL_VISIBLE = 5;

export default function ProfileTransactionHistory({
  transactions,
}: TransactionHistoryProps) {
  const [expanded, setExpanded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

  const hasTransactions = transactions.length > 0;
  const visible = expanded ? transactions.slice(0, visibleCount) : [];
  const hasMore = transactions.length > visibleCount;

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/80 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-neutral-50">Transaction history</h2>
          <p className="mt-1 text-xs text-neutral-400">
            Track bankroll grants, bets, payouts, and refunds over time.
          </p>
        </div>

        {hasTransactions ? (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="rounded-full border border-neutral-700 bg-neutral-950 px-3 py-1 text-xs font-semibold text-neutral-200 hover:border-amber-300 hover:text-amber-200"
          >
            {expanded ? "Collapse" : "Show recent transactions"}
          </button>
        ) : null}
      </div>

      {!hasTransactions ? (
        <p className="mt-3 text-sm text-neutral-400">No transactions yet.</p>
      ) : null}

      {expanded && visible.length > 0 ? (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm text-neutral-100">
              <thead className="bg-neutral-900 text-[11px] uppercase tracking-wide text-neutral-400">
                <tr>
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Contest</th>
                  <th className="px-3 py-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((tx: any) => {
                  const isRefund = tx.type === TransactionType.VOID_REFUND;
                  const typeLabel = tx.type as TransactionType;

                  const typeText =
                    typeLabel === TransactionType.BET
                      ? "Bet"
                      : typeLabel === TransactionType.PAYOUT
                        ? "Payout"
                        : typeLabel === TransactionType.VOID_REFUND
                          ? "Refund"
                          : typeLabel === TransactionType.GRANT
                            ? "Bankroll Grant"
                            : typeLabel === TransactionType.ADJUSTMENT
                              ? "Adjustment"
                              : typeLabel;

                  return (
                    <tr
                      key={tx.id}
                      className={[
                        "border-t border-neutral-800/70",
                        isRefund ? "bg-red-500/5" : "hover:bg-neutral-900/70",
                      ].join(" ")}
                    >
                      <td className="px-3 py-2 text-sm text-neutral-300">
                        {formatDateTime(new Date(tx.createdAt))}
                      </td>

                      <td className="px-3 py-2 text-sm text-neutral-100">
                        <div className="flex items-center gap-2">
                          <span>{typeText}</span>
                          {isRefund ? (
                            <span className="rounded border border-red-400/70 bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-300">
                              Scratched Player
                            </span>
                          ) : null}
                        </div>
                      </td>

                      <td
                        className={`px-3 py-2 text-sm ${
                          tx.amount >= 0 ? "text-emerald-300" : "text-red-300"
                        }`}
                      >
                        {tx.amount > 0 ? "+" : ""}
                        {formatCoins(tx.amount)}
                      </td>

                      <td className="px-3 py-2 text-sm text-neutral-100">
                        {tx.contest?.title ?? "—"}
                      </td>

                      <td className="px-3 py-2 text-sm text-neutral-300">
                        {isRefund
                          ? tx.note || "Refund for scratched player"
                          : tx.note ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-end gap-2">
            {hasMore ? (
              <button
                type="button"
                onClick={() =>
                  setVisibleCount((current) =>
                    Math.min(current + INITIAL_VISIBLE, transactions.length)
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

