export type LobbyOddsSource = "LIVE" | "OPENING" | "NONE";

export type LobbyPreviewOdds = {
  oddsTo1: number | null;
  /** Payout multiple (odds-to-1 + 1) when known — used for long-shot sorting only. */
  winMultiple: number | null;
  oddsSource: LobbyOddsSource;
  oddsLabel: string;
  oddsEstablished: boolean;
};

/** Format odds-to-1 for lobby boards (e.g. 12-1). */
export function formatLobbyOddsTo1(oddsTo1: number): string {
  if (!Number.isFinite(oddsTo1)) return "Odds not established";
  if (oddsTo1 < 1) return `${(oddsTo1 + 1).toFixed(2)}x`;
  const rounded = Math.round(oddsTo1 * 10) / 10;
  return `${rounded}-1`;
}

/**
 * Preview-board odds priority:
 * 1) Live WIN-pool odds once that runner has pool activity
 * 2) Admin opening line
 * 3) Empty state
 *
 * Does not affect pari-mutuel math or payouts.
 */
export function selectLobbyPreviewOdds(input: {
  /** Live payout multiple from pool (null when no WIN stake on this lane). */
  liveWinMultiple: number | null | undefined;
  winPoolAmount: number;
  openingWinOddsTo1: number | null | undefined;
}): LobbyPreviewOdds {
  const winPoolAmount = Number(input.winPoolAmount) || 0;
  const liveMultiple =
    input.liveWinMultiple != null && Number.isFinite(input.liveWinMultiple)
      ? input.liveWinMultiple
      : null;
  const currentWinOddsTo1 =
    liveMultiple != null && liveMultiple > 0 ? Math.max(liveMultiple - 1, 0) : null;
  const opening =
    input.openingWinOddsTo1 != null && Number.isFinite(input.openingWinOddsTo1)
      ? input.openingWinOddsTo1
      : null;

  if (currentWinOddsTo1 != null && winPoolAmount > 0) {
    const oddsLabel = `Live Odds: ${formatLobbyOddsTo1(currentWinOddsTo1)}`;
    return {
      oddsTo1: currentWinOddsTo1,
      winMultiple: liveMultiple,
      oddsSource: "LIVE",
      oddsLabel,
      oddsEstablished: true,
    };
  }

  if (opening != null) {
    return {
      oddsTo1: opening,
      winMultiple: opening + 1,
      oddsSource: "OPENING",
      oddsLabel: `Opening Odds: ${formatLobbyOddsTo1(opening)}`,
      oddsEstablished: true,
    };
  }

  return {
    oddsTo1: null,
    winMultiple: null,
    oddsSource: "NONE",
    oddsLabel: "Odds not established",
    oddsEstablished: false,
  };
}
