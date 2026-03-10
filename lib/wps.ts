// lib/wps.ts
import { Market } from "@prisma/client";

export type BetRow = {
  id: string;
  ticketId?: string | null; // ✅ NEW: used to open TicketDetailModal
  laneId: string;
  laneName: string;
  market: Market; // WIN | PLACE | SHOW | etc
  amount: number; // coins (positive)
  createdAt?: string; // optional, but REQUIRED for correct WPS grouping
};

export type TicketLine =
  | {
      kind: "WPS";
      key: string;
      ticketId?: string | null; // ✅ NEW: representative ticketId for the group
      laneId: string;
      laneName: string;
      win: number;
      place: number;
      show: number;
      total: number;
      createdAt?: string; // representative time
    }
  | {
      kind: "SINGLE";
      id: string;
      ticketId?: string | null; // ✅ NEW
      laneId: string;
      laneName: string;
      market: Market;
      amount: number;
      createdAt?: string;
    };

function isWpsLeg(market: Market) {
  return market === Market.WIN || market === Market.PLACE || market === Market.SHOW;
}

export function collapseWps(lines: BetRow[], windowMs = 2000): TicketLine[] {
  // Sort newest-first so UI stays consistent with your "prepend new" behavior
  const sorted = [...lines].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });

  const used = new Set<string>();
  const out: TicketLine[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    if (used.has(a.id)) continue;

    // Try to form a WPS group starting from this row
    if (a.createdAt && isWpsLeg(a.market)) {
      const aTime = new Date(a.createdAt).getTime();
      if (Number.isFinite(aTime)) {
        // Find candidates in the remaining list that match lane + amount + within time window
        const candidates = sorted.filter((x) => {
          if (used.has(x.id)) return false;
          if (!x.createdAt) return false;
          if (!isWpsLeg(x.market)) return false;
          if (x.laneId !== a.laneId) return false;
          if (x.amount !== a.amount) return false;

          const t = new Date(x.createdAt).getTime();
          return Number.isFinite(t) && Math.abs(t - aTime) <= windowMs;
        });

        // Need one each of WIN/PLACE/SHOW
        const win = candidates.find((c) => c.market === Market.WIN);
        const place = candidates.find((c) => c.market === Market.PLACE);
        const show = candidates.find((c) => c.market === Market.SHOW);

        if (win && place && show) {
          used.add(win.id);
          used.add(place.id);
          used.add(show.id);

          // Pick a representative ticketId for this grouped "ticket"
          const repTicketId =
            win.ticketId ?? place.ticketId ?? show.ticketId ?? a.ticketId ?? null;

          out.push({
            kind: "WPS",
            key: `wps-${win.id}-${place.id}-${show.id}`,
            ticketId: repTicketId,
            laneId: a.laneId,
            laneName: a.laneName,
            win: win.amount,
            place: place.amount,
            show: show.amount,
            total: win.amount + place.amount + show.amount,
            createdAt: a.createdAt,
          });

          continue; // don't also output singles for these
        }
      }
    }

    // Not part of a WPS group → output as single
    used.add(a.id);
    out.push({
      kind: "SINGLE",
      id: a.id,
      ticketId: a.ticketId ?? null,
      laneId: a.laneId,
      laneName: a.laneName,
      market: a.market,
      amount: a.amount,
      createdAt: a.createdAt,
    });
  }

  return out;
}