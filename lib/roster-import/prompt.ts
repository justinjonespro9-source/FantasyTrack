export type RosterPromptConfig = {
  season: number;
  week: number;
  contestType: string;
  position: string;
  slate: string;
  scoring: string;
  rolePreset: string;
  includeProjections: boolean;
  includeStatus: boolean;
  includeNotes: boolean;
  excludeSnf?: boolean;
};

const SLATE_LABELS: Record<string, string> = {
  SUNDAY_EARLY: "Sunday early games only",
  SUNDAY_LATE: "Sunday late games only",
  SUNDAY_AFTERNOON: "Sunday afternoon games only",
  PRIME_TIME: "Prime-time games only",
  SINGLE_GAME: "Single game slate",
  CUSTOM: "Custom slate",
};

const SCORING_LABELS: Record<string, string> = {
  PPR: "Full PPR",
  HALF_PPR: "Half PPR",
  STANDARD: "Standard (non-PPR)",
};

const ROLE_PRESET_LABELS: Record<string, string> = {
  "RB:RB1": "each eligible team's projected RB1 only",
  "RB:RB1_RB2": "each eligible team's projected RB1 and RB2",
  "RB:TOP3": "the top 3 fantasy-relevant RBs per eligible team",
  "RB:ALL_RELEVANT": "all fantasy-relevant RBs",
  "QB:QB1": "each eligible team's projected QB1 only",
  "QB:QB1_BACKUP": "each eligible team's projected QB1 and backup",
  "WR:WR1_WR2": "each eligible team's projected WR1 and WR2",
  "WR:WR1_WR3": "each eligible team's projected WR1 through WR3",
  "WR:ALL_RELEVANT": "all fantasy-relevant WRs",
  "TE:TE1": "each eligible team's projected TE1 only",
  "TE:TE1_TE2": "each eligible team's projected TE1 and TE2",
  "SINGLE:QB": "both starting QBs",
  "SINGLE:RB": "fantasy-relevant RBs from both teams",
  "SINGLE:WR": "fantasy-relevant WRs from both teams",
  "SINGLE:TE": "fantasy-relevant TEs from both teams",
  "SINGLE:ALL_SKILL": "all fantasy-relevant skill players from both teams",
};

export function getRolePresetsForPosition(position: string, contestType: string) {
  if (contestType === "SINGLE_GAME") {
    return [
      { value: "SINGLE:QB", label: "QB" },
      { value: "SINGLE:RB", label: "RB" },
      { value: "SINGLE:WR", label: "WR" },
      { value: "SINGLE:TE", label: "TE" },
      { value: "SINGLE:ALL_SKILL", label: "All fantasy-relevant skill players" },
    ];
  }

  switch (position.toUpperCase()) {
    case "QB":
      return [
        { value: "QB:QB1", label: "QB1 only" },
        { value: "QB:QB1_BACKUP", label: "QB1 and backup" },
      ];
    case "WR":
      return [
        { value: "WR:WR1_WR2", label: "WR1 and WR2" },
        { value: "WR:WR1_WR3", label: "WR1 through WR3" },
        { value: "WR:ALL_RELEVANT", label: "All fantasy-relevant" },
      ];
    case "TE":
      return [
        { value: "TE:TE1", label: "TE1 only" },
        { value: "TE:TE1_TE2", label: "TE1 and TE2" },
      ];
    case "RB":
    default:
      return [
        { value: "RB:RB1", label: "RB1 only" },
        { value: "RB:RB1_RB2", label: "RB1 and RB2" },
        { value: "RB:TOP3", label: "Top 3 per team" },
        { value: "RB:ALL_RELEVANT", label: "All fantasy-relevant" },
      ];
  }
}

export function expectedRolesFromPreset(rolePreset: string): string[] {
  switch (rolePreset) {
    case "RB:RB1":
      return ["RB1"];
    case "RB:RB1_RB2":
      return ["RB1", "RB2"];
    case "QB:QB1":
      return ["QB1"];
    case "TE:TE1":
      return ["TE1"];
    case "TE:TE1_TE2":
      return ["TE1", "TE2"];
    case "WR:WR1_WR2":
      return ["WR1", "WR2"];
    case "WR:WR1_WR3":
      return ["WR1", "WR2", "WR3"];
    default:
      return [];
  }
}

export function buildAiRosterPrompt(config: RosterPromptConfig): string {
  const slateLabel = SLATE_LABELS[config.slate] ?? config.slate;
  const scoringLabel = SCORING_LABELS[config.scoring] ?? config.scoring;
  const includeLabel =
    ROLE_PRESET_LABELS[config.rolePreset] ?? "the requested player set";

  const fields = [
    "Rank",
    "Player name",
    "Team abbreviation",
    "Opponent abbreviation",
    "Position",
  ];
  if (config.includeProjections || true) fields.push("Depth-chart role");
  if (config.includeProjections) fields.push("Projected fantasy points");
  if (config.includeStatus) fields.push("Status");
  if (config.includeNotes) fields.push("Short role note");

  const sampleFields = [
    "1",
    "Player Name",
    "TEAM",
    "OPP",
    config.position.toUpperCase() || "RB",
    "RB1",
  ];
  if (config.includeProjections) sampleFields.push("15.2");
  if (config.includeStatus) sampleFields.push("ACTIVE");
  if (config.includeNotes) sampleFields.push("Lead back");

  const excludeLine =
    config.excludeSnf !== false && config.slate === "SUNDAY_AFTERNOON"
      ? "- Exclude Sunday Night Football\n"
      : "";

  return `Build a FantasyTrack player import for the following NFL contest.

Contest:
- Season: ${config.season}
- Week: ${config.week}
- Contest type: ${config.contestType}
- Slate: ${slateLabel}
${excludeLine}- Position: ${config.position.toUpperCase()}
- Include ${includeLabel}
- Scoring: ${scoringLabel}

Return only a structured FantasyTrack import block.

For every player include:
${fields.map((f) => `- ${f}`).join("\n")}

Use this exact format:

[FANTASYTRACK_IMPORT]
contestType: ${config.contestType}
sport: NFL
season: ${config.season}
week: ${config.week}
position: ${config.position.toUpperCase()}
scoring: ${config.scoring}
slate: ${config.slate}

${sampleFields.join(" | ")}
[/FANTASYTRACK_IMPORT]

Do not include explanations before or after the import block.`;
}
