import { prisma } from "@/lib/prisma";

export async function createLanesFromPlayers(contestId: string, playerIds: string[]) {
  if (!playerIds.length) return;

  const uniquePlayerIds = Array.from(new Set(playerIds));

  const [contest, existingLanes, players] = await Promise.all([
    prisma.contest.findUnique({
      where: { id: contestId },
      select: { id: true, sport: true },
    }),
    prisma.lane.findMany({
      where: {
        contestId,
        playerId: { in: uniquePlayerIds },
      },
      select: { playerId: true },
    }),
    prisma.player.findMany({
      where: { id: { in: uniquePlayerIds } },
      include: {
        team: true,
      },
    }),
  ]);

  if (!contest) {
    throw new Error("Contest not found.");
  }

  const existingPlayerIds = new Set(
    existingLanes.map((lane) => lane.playerId).filter((id): id is string => !!id)
  );

  const playersToCreate = players.filter((p) => !existingPlayerIds.has(p.id));
  if (playersToCreate.length === 0) return;

  await prisma.lane.createMany({
    data: playersToCreate.map((player) => {
      const teamLabel = player.team
        ? [player.team.market, player.team.name].filter(Boolean).join(" ")
        : "";

      return {
        contestId,
        playerId: player.id,
        name: player.fullName,
        team: teamLabel,
        position: player.position ?? "",
        status: "ACTIVE",
      };
    }),
  });
}

