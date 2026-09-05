/**
 * Flip open FantasyTrack contests to canonical Half PPR V2 scoring format.
 *
 * Does NOT recompute settled Lane.fantasyPoints.
 *
 * Usage:
 *   npx tsx scripts/set-fantasy-scoring-version-v2.ts          # dry run
 *   npx tsx scripts/set-fantasy-scoring-version-v2.ts --apply  # write
 *
 * Sets Contest.scoringFormat = "HALF_PPR" for PUBLISHED/LOCKED/DRAFT football
 * contests that are not already explicitly Full PPR (PPR) or frozen to
 * FANTASYTRACK_NFL_HALF_PPR_V1.
 */
import { ContestStatus } from "@prisma/client";
import { FANTASYTRACK_NFL_HALF_PPR_V1 } from "../lib/fantasy/scoring-config";
import { prisma } from "../lib/prisma";

const APPLY = process.argv.includes("--apply");

async function main() {
  const rows = await prisma.contest.findMany({
    where: {
      archivedAt: null,
      sport: { in: ["FOOTBALL", "NFL"] },
      status: {
        in: [ContestStatus.DRAFT, ContestStatus.PUBLISHED, ContestStatus.LOCKED],
      },
    },
    select: {
      id: true,
      title: true,
      status: true,
      scoringFormat: true,
      week: true,
      season: true,
    },
    orderBy: { startTime: "asc" },
  });

  const toFlip = rows.filter((c) => {
    const fmt = (c.scoringFormat ?? "").trim().toUpperCase();
    if (fmt === "PPR" || fmt === "FULL_PPR") return false;
    if (fmt === FANTASYTRACK_NFL_HALF_PPR_V1 || fmt === "HALF_PPR_V1") return false;
    // Already HALF_PPR resolves to V2 via resolveContestFantasyScoringVersion —
    // still normalize empty/legacy labels to HALF_PPR for clarity.
    return fmt !== "HALF_PPR";
  });

  console.log(`Open football contests: ${rows.length}`);
  console.log(`Would set scoringFormat=HALF_PPR (→ V2 engine): ${toFlip.length}`);
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY RUN"}\n`);

  for (const c of toFlip) {
    console.log(
      `- ${c.title} [${c.status}] week=${c.week} format=${c.scoringFormat ?? "(null)"} → HALF_PPR`
    );
    if (APPLY) {
      await prisma.contest.update({
        where: { id: c.id },
        data: { scoringFormat: "HALF_PPR" },
      });
    }
  }

  if (!APPLY) {
    console.log("\nRe-run with --apply to write. Settled contests are skipped.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
