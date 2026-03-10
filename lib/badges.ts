import type { LeaderboardEntry } from "@/lib/market";

export type ProfileBadge = {
  id: string;
  label: string;
  description: string;
  tier?: number;
};

export type LeaderboardBadge = {
  id: string;
  label: string;
};

type ProfileBadgeInput = {
  totalContestsEntered: number;
  totalSettledContests: number;
  profitableContests: number;
  totalWagered: number;
  netProfitLoss: number;
  roiPercent: number | null;
  ticketCount: number;
};

export function resolveProfileBadges(input: ProfileBadgeInput): ProfileBadge[] {
  const {
    totalContestsEntered,
    totalSettledContests,
    profitableContests,
    totalWagered,
    netProfitLoss,
    roiPercent,
    ticketCount,
  } = input;

  const badges: ProfileBadge[] = [];

  const profitablePercent =
    totalSettledContests > 0 ? (profitableContests / totalSettledContests) * 100 : 0;

  // Contest Regular
  if (totalContestsEntered >= 5) {
    let tier = 1;
    if (totalContestsEntered >= 30) tier = 3;
    else if (totalContestsEntered >= 15) tier = 2;

    badges.push({
      id: "contest-regular",
      label: "Contest Regular",
      description: `${totalContestsEntered} contests entered`,
      tier,
    });
  }

  // Ticket Volume
  if (ticketCount >= 20) {
    let tier = 1;
    if (ticketCount >= 100) tier = 3;
    else if (ticketCount >= 50) tier = 2;

    badges.push({
      id: "ticket-volume",
      label: "Ticket Volume",
      description: `${ticketCount} tickets placed`,
      tier,
    });
  }

  // Sharp Sessions (profitable contests)
  if (totalSettledContests >= 10 && profitablePercent >= 30) {
    let tier = 1;
    if (profitablePercent >= 50) tier = 2;

    const pctLabel = profitablePercent.toFixed(1).replace(/\.0$/, "");

    badges.push({
      id: "sharp-sessions",
      label: "Sharp Sessions",
      description: `${pctLabel}% of settled contests profitable`,
      tier,
    });
  }

  // Profitable Player (ROI-based)
  const roi = roiPercent ?? (totalWagered > 0 ? (netProfitLoss / totalWagered) * 100 : null);

  if (roi != null && totalWagered >= 300 && roi >= 5) {
    let tier = 1;
    if (roi >= 50) tier = 3;
    else if (roi >= 20) tier = 2;

    const roiLabel = roi.toFixed(1).replace(/\.0$/, "");

    badges.push({
      id: "profitable-player",
      label: "Profitable Player",
      description: `ROI ${roiLabel}% on ${formatCoinsShort(totalWagered)} wagered`,
      tier,
    });
  }

  // Sort badges by rough importance: profitable > sharp > contest regular > volume
  const priorityOrder: Record<string, number> = {
    "profitable-player": 0,
    "sharp-sessions": 1,
    "contest-regular": 2,
    "ticket-volume": 3,
  };

  badges.sort((a, b) => {
    const pa = priorityOrder[a.id] ?? 99;
    const pb = priorityOrder[b.id] ?? 99;
    if (pa !== pb) return pa - pb;
    return (b.tier ?? 0) - (a.tier ?? 0);
  });

  return badges;
}

// Leaderboard indicator – keep it simple and cheap:
// Use only data available on LeaderboardEntry (net, totalWagered, participatedContests, eligible).
export function resolvePrimaryBadgeForLeaderboard(
  entry: LeaderboardEntry
): LeaderboardBadge | null {
  const { totalWagered, net, participatedContests } = entry;

  const roi = totalWagered > 0 ? (net / totalWagered) * 100 : null;

  // Prefer Profitable Player if ROI is strong
  if (roi != null && totalWagered >= 300 && roi >= 5) {
    const roiLabel = roi.toFixed(0);
    return {
      id: "profitable-player",
      label: `Profitable ${roiLabel}%`,
    };
  }

  // Otherwise, show Contest Regular if they have solid participation
  if (participatedContests >= 15) {
    return {
      id: "contest-regular",
      label: `${participatedContests} contests`,
    };
  }

  return null;
}

function formatCoinsShort(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1000000) {
    return `${Math.round(abs / 10000) / 100}M`;
  }
  if (abs >= 1000) {
    return `${Math.round(abs / 10) / 100}K`;
  }
  return String(abs);
}

