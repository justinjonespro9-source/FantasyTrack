import type { Metadata } from "next";
import PositionRacesLobby from "@/components/position-races/position-races-lobby";
import { buildPositionRacesLobby } from "@/lib/position-races/build-lobby";

/**
 * Public homepage showcase — shares the Races experience.
 * Canonical product discovery lives at /races.
 */
export const metadata: Metadata = {
  alternates: {
    canonical: "/races",
  },
  robots: {
    // /home reuses the Races lobby; avoid duplicate indexing.
    index: false,
    follow: true,
  },
};

export default async function FantasyTrackHomePage() {
  const initialData = await buildPositionRacesLobby();
  return <PositionRacesLobby initialData={initialData} variant="home" />;
}
