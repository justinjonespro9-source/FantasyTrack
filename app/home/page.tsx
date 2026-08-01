import PositionRacesLobby from "@/components/position-races/position-races-lobby";
import { buildPositionRacesLobby } from "@/lib/position-races/build-lobby";

export default async function FantasyTrackHomePage() {
  const initialData = await buildPositionRacesLobby();

  return <PositionRacesLobby initialData={initialData} />;
}
