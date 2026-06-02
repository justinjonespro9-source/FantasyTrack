import type { Metadata } from "next";
import FantasyTrackHomePage from "./home/page";

const title = "Player performance market";
const description =
  "FantasyTrack turns athlete performance into a live race. Pick your runners, track the fantasy leaderboard, and win when your ticket finishes on the podium.";

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