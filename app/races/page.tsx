import type { Metadata } from "next";
import PositionRacesLobby from "@/components/position-races/position-races-lobby";
import { buildPositionRacesLobby } from "@/lib/position-races/build-lobby";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Races",
  description:
    "Explore live FantasyTrack player-performance races, including weekly NFL position markets for quarterbacks, running backs, wide receivers, and tight ends.",
  alternates: {
    canonical: "/races",
  },
  openGraph: {
    title: "Races | FantasyTrack",
    description:
      "Explore live FantasyTrack player-performance races, including weekly NFL position markets.",
    url: "/races",
  },
  twitter: {
    title: "Races | FantasyTrack",
    description:
      "Explore live FantasyTrack player-performance races, including weekly NFL position markets.",
  },
};

type PageProps = {
  searchParams?: { sport?: string };
};

export default async function RacesPage({ searchParams }: PageProps) {
  const initialData = await buildPositionRacesLobby();
  return (
    <PositionRacesLobby
      initialData={initialData}
      initialSport={searchParams?.sport}
      variant="races"
    />
  );
}
