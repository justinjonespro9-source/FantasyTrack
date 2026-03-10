"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCoins, formatDateTime } from "@/lib/format";

type TicketDetailResponse = {
  ticket: {
    id: string;
    status: string;
    result: string;
    stakeAmount: number;
    payoutAmount: number | null;
    netAmount: number | null;
    placedAt: string;
    settledAt: string | null;
    settlementVer: number;
    note: string | null;
    contest: { id: string; title: string; status: string; startTime: string | null };
    series: { id: string; name: string } | null;
    legs: Array<{
      id: string;
      market: string;
      amount: number;
      laneId: string;
      laneNameSnap: string | null;
      teamSnap: string | null;
      positionSnap: string | null;
      oddsTo1Snap: number | null;
      result: string;
      settledAt: string | null;
      isVoided: boolean;
      voidReason: string | null;
      voidedAt: string | null;
      lane: { name: string };
    }>;
    transactions: Array<{
      id: string;
      createdAt: string;
      type: string;
      amount: number;
      ticketLegId: string | null;
      note: string | null;
    }>;
  };
  computed: { betTotal: number; refundTotal: number };
};

function shortId(id: string) {
  return id.length <= 10 ? id : `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function clsx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function formatOddsTo1(oddsTo1: number | null | undefined) {
  if (oddsTo1 == null) return "—";
  return `${oddsTo1}-1`;
}

export function TicketDetailModal({
  ticketId,
  open,
  onClose,
}: {
  ticketId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const [data, setData] = useState<TicketDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !ticketId) return;

    let alive = true;
    setLoading(true);
    setErr(null);
    setData(null);

    fetch(`/api/tickets/${ticketId}`, { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error ?? "Failed to load ticket");
        return j as TicketDetailResponse;
      })
      .then((j) => {
        if (alive) setData(j);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setErr(e instanceof Error ? e.message : "Failed to load ticket");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [open, ticketId]);

  const ticket = data?.ticket ?? null;

  const derived = useMemo(() => {
    if (!ticket) return null;

    const legBetTotal = ticket.legs.reduce((sum, l) => sum + (l.amount ?? 0), 0);
    const stake = ticket.stakeAmount ?? legBetTotal;
    const payout = ticket.payoutAmount ?? null;
    const net = ticket.netAmount ?? (payout != null ? payout - stake : null);
    const voidedLegs = ticket.legs.filter((l) => l.isVoided);
    const refunded = data?.computed?.refundTotal ? data.computed.refundTotal > 0 : false;

    return {
      stake,
      payout,
      net,
      voidedLegs,
      refunded,
    };
  }, [ticket, data?.computed?.refundTotal]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        aria-label="Close"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      <div className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b p-4">
          <div>
            <div className="text-sm text-gray-500">Ticket</div>
            <div className="text-lg font-semibold">{ticket ? shortId(ticket.id) : "…"}</div>
            {ticket ? (
              <div className="mt-1 text-xs text-gray-500">
                {ticket.contest.title}
                {ticket.series?.name ? ` • ${ticket.series.name}` : ""}
              </div>
            ) : null}
          </div>
          <button
            className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="space-y-4 p-4">
          {loading ? (
            <div className="text-sm text-gray-600">Loading ticket…</div>
          ) : err ? (
            <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {err}
            </div>
          ) : !ticket || !derived ? (
            <div className="text-sm text-gray-600">No ticket data.</div>
          ) : (
            <>
              <div className="rounded border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold">Summary</div>
                  <div className="flex items-center gap-2">
                    <span
                      className={clsx(
                        "rounded px-2 py-0.5 text-xs",
                        ticket.status === "SUBMITTED" && "bg-blue-50 text-blue-700",
                        ticket.status === "REFUNDED" && "bg-amber-50 text-amber-700",
                        ticket.status === "SETTLED" && "bg-green-50 text-green-700",
                        !["SUBMITTED", "REFUNDED", "SETTLED"].includes(ticket.status) &&
                          "bg-gray-100 text-gray-700"
                      )}
                    >
                      {ticket.status}
                    </span>
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                      {ticket.result}
                    </span>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-xs text-gray-500">Stake</div>
                    <div className="font-semibold">{formatCoins(derived.stake)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Payout</div>
                    <div className="font-semibold">
                      {derived.payout == null ? "—" : formatCoins(derived.payout)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Net</div>
                    <div className="font-semibold">
                      {derived.net == null ? "—" : formatCoins(derived.net)}
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <div>
                    Placed:{" "}
                    <span className="text-gray-900">
                      {formatDateTime(new Date(ticket.placedAt))}
                    </span>
                  </div>
                  <div>
                    Settled:{" "}
                    <span className="text-gray-900">
                      {ticket.settledAt ? formatDateTime(new Date(ticket.settledAt)) : "—"}
                    </span>
                  </div>
                  <div>
                    Settlement ver: <span className="text-gray-900">{ticket.settlementVer}</span>
                  </div>
                  <div>
                    Voided legs:{" "}
                    <span className="text-gray-900">{derived.voidedLegs.length}</span>
                  </div>
                </div>

                {ticket.note ? (
                  <div className="mt-3 text-xs text-gray-600">
                    Note: <span className="text-gray-900">{ticket.note}</span>
                  </div>
                ) : null}
              </div>

              <div className="rounded border p-3">
                <div className="text-sm font-semibold">Legs</div>

                {ticket.legs.length === 0 ? (
                  <div className="mt-2 text-sm text-gray-600">No legs found for this ticket.</div>
                ) : (
                  <div className="mt-3 overflow-hidden rounded border border-track-200 bg-white">
                    <table className="w-full table-fixed text-left text-sm">
                      <colgroup>
                        <col className="w-[58%]" />
                        <col className="w-[18%]" />
                        <col className="w-[24%]" />
                      </colgroup>

                      <thead className="bg-track-50 text-track-600">
                        <tr>
                          <th className="px-3 py-2 font-medium">Lane</th>
                          <th className="px-3 py-2 font-medium">Market</th>
                          <th className="px-3 py-2 text-right font-medium">Wager amount</th>
                        </tr>
                      </thead>

                      <tbody>
                        {ticket.legs.map((l) => {
                          const laneLabel = l.laneNameSnap || l.lane?.name || "—";
                          const oddsLabel = l.market === "WIN" ? formatOddsTo1(l.oddsTo1Snap) : null;
                          const refunded = l.isVoided || Boolean(l.voidReason);

                          return (
                            <tr key={l.id} className="border-t border-track-100 align-top">
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <span className={refunded ? "text-track-500 line-through" : undefined}>
                                    {laneLabel}
                                  </span>

                                  {oddsLabel ? (
                                    <span className="rounded bg-track-100 px-2 py-0.5 text-xs font-semibold text-track-700">
                                      {oddsLabel}
                                    </span>
                                  ) : null}

                                  {refunded ? (
                                    <span className="rounded border border-red-300 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                                      Refunded
                                    </span>
                                  ) : null}
                                </div>

                                {(l.teamSnap || l.positionSnap) && (
                                  <div className="mt-1 text-xs text-gray-500">
                                    {l.teamSnap ? `${l.teamSnap}` : ""}
                                    {l.positionSnap ? ` • ${l.positionSnap}` : ""}
                                  </div>
                                )}

                                <div className="mt-1 text-xs text-gray-500">
                                  Result: {l.result}
                                  {l.settledAt ? ` • ${formatDateTime(new Date(l.settledAt))}` : ""}
                                  {l.isVoided && l.voidReason ? ` • VOID: ${l.voidReason}` : ""}
                                </div>
                              </td>

                              <td className="px-3 py-2">
                                <span
                                    className={`rounded border px-2 py-0.5 text-xs font-semibold ${
                                        l.market === "WIN"
                                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                        : l.market === "PLACE"
                                        ? "border-sky-200 bg-sky-50 text-sky-700"
                                        : l.market === "SHOW"
                                        ? "border-amber-200 bg-amber-50 text-amber-700"
                                        : "border-track-200 bg-track-50 text-track-700"
                                    }`}
                                    >
                                    {l.market ?? "—"}
                                    </span>
                              </td>

                              <td className="px-3 py-2 text-right font-medium text-track-900">
                                <span className={refunded ? "text-track-500 line-through" : undefined}>
                                  {formatCoins(l.amount ?? 0)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="rounded border p-3">
                <div className="text-sm font-semibold">Transactions</div>
                <div className="mt-2 space-y-2">
                  {ticket.transactions.length === 0 ? (
                    <div className="text-sm text-gray-600">No transactions.</div>
                  ) : (
                    ticket.transactions.map((t) => (
                      <div key={t.id} className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">{t.type}</div>
                          <div className="text-xs text-gray-600">
                            {formatDateTime(new Date(t.createdAt))}
                            {t.note ? ` • ${t.note}` : ""}
                          </div>
                        </div>
                        <div className="text-right text-sm font-semibold">
                          {formatCoins(Math.abs(t.amount))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <CopyTicketBlock ticket={ticket} stake={derived.stake} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CopyTicketBlock({
  ticket,
  stake,
}: {
  ticket: TicketDetailResponse["ticket"];
  stake: number;
}) {
  const lines = [
    `FantasyTrack Ticket ${ticket.id}`,
    `${ticket.contest.title}${ticket.series?.name ? ` • ${ticket.series.name}` : ""}`,
    `Placed: ${new Date(ticket.placedAt).toLocaleString()}`,
    `Stake: ${stake}`,
    "",
    ...ticket.legs.map((l) => {
      const lane = l.laneNameSnap || l.lane?.name || "—";
      const odds = l.oddsTo1Snap == null ? "—" : `${l.oddsTo1Snap}-1`;
      const voidTag = l.isVoided ? " (VOID)" : "";
      return `${l.market} • ${lane} • ${l.amount} • locked ${odds}${voidTag}`;
    }),
  ].join("\n");

  return (
    <div className="rounded border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold">Copy ticket</div>
        <button
          className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
          onClick={async () => {
            await navigator.clipboard.writeText(lines);
          }}
        >
          Copy
        </button>
      </div>
      <pre className="mt-2 whitespace-pre-wrap rounded bg-gray-50 p-2 text-xs text-gray-700">
        {lines}
      </pre>
    </div>
  );
}