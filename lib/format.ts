export function formatCoins(value: number | null | undefined): string {
  const amount = Number(value ?? 0);
  const abs = Math.abs(amount).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  return amount < 0 ? `-$${abs}` : `$${abs}`;
}

export function formatMultiple(value: number | null): string {
  if (value === null) {
    return "—";
  }
  return `${value.toFixed(2)}x`;
}

export function formatOddsTo1(oddsTo1?: number | null): string {
  if (oddsTo1 == null) return "";
  const rounded = Math.round(oddsTo1 * 10) / 10;
  return `${rounded}\u20131`;
}

/** Opening WIN line snapshot (e.g. at wager time). Not final pool / locked payout unless stored separately. */
export function formatOpeningWinOddsCaption(oddsTo1?: number | null): string | null {
  if (oddsTo1 == null) return null;
  return `Open odds: ${formatOddsTo1(oddsTo1)}`;
}

export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    // Schedule feeds are normalized to America/New_York in the ingest mappers,
    // but some pages render on the server (which can default to UTC).
    // Force Eastern so start times don't shift by the server's timezone.
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
