export function formatTrackConditionsLabel(code?: string | null): string {
  switch (code) {
    case "COLD_ICY":
      return "Cold / Icy";
    case "HARDWOOD_FAST":
      return "Hardwood / Fast";
    case "GAME_DAY":
      return "Game Day";
    case "FAST":
      return "Fast";
    case "GOOD":
      return "Good";
    case "SLOW":
      return "Slow";
    case "HEAVY":
      return "Heavy";
    case "FROZEN":
      return "Frozen";
    case "SLOPPY":
      return "Sloppy";
    case "WET":
      return "Wet";
    case "NEUTRAL":
    default:
      return "Neutral";
  }
}

