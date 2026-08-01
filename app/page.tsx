import type { Metadata } from "next";
import FantasyTrackHomePage from "./home/page";

const title = "Week 1 Position Races";
const description =
  "FantasyTrack Week 1 Position Races — pick the QB, RB, WR, or TE who finishes Sunday on top. Free-play pooled markets with live odds.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title,
    description,
    url: "/",
  },
  twitter: {
    title,
    description,
  },
};

export default function Page() {
  return <FantasyTrackHomePage />;
}