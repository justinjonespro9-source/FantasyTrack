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

export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
