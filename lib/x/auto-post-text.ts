type LockReminderContest = {
  id: string;
  title: string;
  startTime: Date;
  series?: { name: string } | null;
};

type SettlementContest = {
  id: string;
  title: string;
  series?: { name: string } | null;
};

type PodiumEntry = {
  rank: number;
  name: string;
  fantasyPoints: number | null;
};

function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
}

function contestUrl(contestId: string): string {
  return `${appBaseUrl()}/contest/${contestId}`;
}

function fmtDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }).format(date);
}

function fmtPoints(points: number | null): string {
  if (points == null) return "—";
  return Number.isInteger(points) ? String(points) : points.toFixed(2).replace(/\.?0+$/, "");
}

export function buildLockReminderPost(contest: LockReminderContest): string {
  const seriesTag = contest.series?.name ? `${contest.series.name} | ` : "";
  return `${seriesTag}${contest.title} locks in 45 minutes (${fmtDate(contest.startTime)} ET). Get your picks in now: ${contestUrl(contest.id)} #FantasyTrack`;
}

export function buildSettlementRecapPost(
  contest: SettlementContest,
  podiumData: PodiumEntry[]
): string {
  const seriesTag = contest.series?.name ? `${contest.series.name} | ` : "";
  const podiumText =
    podiumData.length > 0
      ? podiumData
          .slice(0, 3)
          .map((p) => `P${p.rank} ${p.name} (${fmtPoints(p.fantasyPoints)} pts)`)
          .join(" | ")
      : "Final podium posted";

  return `${seriesTag}${contest.title} settled. ${podiumText}. Full results: ${contestUrl(contest.id)} #FantasyTrack`;
}
