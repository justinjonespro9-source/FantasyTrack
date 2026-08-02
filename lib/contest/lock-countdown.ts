/**
 * Human-friendly lock countdown. Avoids awkward raw hour counts (e.g. 1024h).
 */
export function formatLockCountdown(
  totalSeconds: number,
  lockAt: Date,
  formatLockDate: (date: Date) => string
): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return "Locked";
  }

  const seconds = Math.floor(totalSeconds);

  if (seconds > 72 * 3600) {
    return `Locks ${formatLockDate(lockAt)}`;
  }

  if (seconds >= 24 * 3600) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return `Locks in ${days}d ${hours}h`;
  }

  if (seconds >= 3600) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `Locks in ${hours}h ${minutes}m`;
  }

  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `Locks in ${minutes}m ${secs}s`;
}
