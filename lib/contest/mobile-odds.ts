/** Primary mobile odds display — always decimal multiples (e.g. 1.53x). */
export function formatMobileWinOdds(
  liveWinMultiple: number | null | undefined,
  openingWinOddsTo1: number | null | undefined
): string {
  if (liveWinMultiple != null && Number.isFinite(liveWinMultiple) && liveWinMultiple > 0) {
    return `${liveWinMultiple.toFixed(2)}x`;
  }
  if (openingWinOddsTo1 != null && Number.isFinite(openingWinOddsTo1)) {
    const multiple = openingWinOddsTo1 + 1;
    if (multiple > 0) return `${multiple.toFixed(2)}x`;
  }
  return "—";
}
