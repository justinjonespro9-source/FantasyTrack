import { redirect } from "next/navigation";

/** Legacy Position Races label → canonical Races hub */
export default function LegacyPositionRacesRedirect({
  searchParams,
}: {
  searchParams?: { sport?: string };
}) {
  const sport = searchParams?.sport?.trim();
  redirect(sport ? `/races?sport=${encodeURIComponent(sport)}` : "/races");
}
