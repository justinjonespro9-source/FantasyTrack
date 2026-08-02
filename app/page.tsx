import type { Metadata } from "next";
import FantasyTrackHomePage from "./home/page";

const title = "Player performance races";
const description =
  "FantasyTrack turns athlete performance into a live race. Explore NFL Week position races, follow the free-play market, and enter from Races.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    // Same lobby as /races — keep discovery indexing on the canonical route.
    canonical: "/races",
  },
  openGraph: {
    title,
    description,
    url: "/races",
  },
  twitter: {
    title,
    description,
  },
};

export default function Page() {
  return <FantasyTrackHomePage />;
}
