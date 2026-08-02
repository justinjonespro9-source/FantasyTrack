export function formatPoolShare(laneTotal: number, poolTotal: number): string {
  if (poolTotal <= 0 || laneTotal <= 0) return "0%";
  return `${((laneTotal / poolTotal) * 100).toFixed(1)}%`;
}
