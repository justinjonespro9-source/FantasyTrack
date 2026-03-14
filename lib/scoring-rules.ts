import type { SportKey } from "@/lib/sports";
import { SPORT_SCORING_RULES_BY_SPORT } from "./scoring-config";

export type ScoringRuleSection = {
  title: string;
  items: string[];
};

export function getScoringRules(sport: string | null | undefined): ScoringRuleSection[] {
  if (!sport) {
    return [
      {
        title: "Scoring Rules",
        items: ["Scoring rules unavailable."],
      },
    ];
  }

  const normalized = sport.toUpperCase() as SportKey;

  return (
    SPORT_SCORING_RULES_BY_SPORT[normalized] ?? [
      {
        title: "Scoring Rules",
        items: ["Scoring rules unavailable."],
      },
    ]
  );
}