import { NextResponse } from "next/server";
import { buildPositionRacesLobby } from "@/lib/position-races/build-lobby";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const weekRaw = searchParams.get("week");
    const seasonRaw = searchParams.get("season");
    const week = weekRaw ? Number(weekRaw) : undefined;
    const season = seasonRaw ? Number(seasonRaw) : undefined;

    const payload = await buildPositionRacesLobby({
      week: week != null && Number.isFinite(week) ? week : undefined,
      season: season != null && Number.isFinite(season) ? season : undefined,
    });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
      },
    });
  } catch (error) {
    console.error("position-races lobby error", error);
    return NextResponse.json(
      { error: "Unable to load position races." },
      { status: 500 }
    );
  }
}
