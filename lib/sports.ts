export const SPORTS = [
  "FOOTBALL",
  "BASKETBALL",
  "BASEBALL",
  "HOCKEY",
  "SOCCER",
  "GOLF",
] as const;

export type SportKey = (typeof SPORTS)[number];

export function formatSportLabel(sport: SportKey): string {
  switch (sport) {
    case "FOOTBALL":
      return "Football";
    case "BASKETBALL":
      return "Basketball";
    case "BASEBALL":
      return "Baseball";
    case "HOCKEY":
      return "Hockey";
    case "SOCCER":
      return "Soccer";
    case "GOLF":
      return "Golf";
    default:
      return sport;
  }
}