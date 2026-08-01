import { describe, expect, it } from "vitest";
import { WEEK1_RB_SAMPLE_IMPORT } from "./fixtures/week1-rb-sample";
import { normalizePlayerName } from "./normalize";
import { parseFantasyTrackImport } from "./parse";
import { canImport, validateFantasyTrackImport } from "./validate";

describe("parseFantasyTrackImport", () => {
  it("parses a valid full import block", () => {
    const result = parseFantasyTrackImport(WEEK1_RB_SAMPLE_IMPORT);
    expect(result.errors.filter((e) => e.code === "MISSING_OPEN_TAG")).toHaveLength(0);
    expect(result.metadata.contestType).toBe("POSITION_WEEKLY");
    expect(result.metadata.sport).toBe("NFL");
    expect(result.metadata.season).toBe(2026);
    expect(result.metadata.week).toBe(1);
    expect(result.metadata.position).toBe("RB");
    expect(result.metadata.scoring).toBe("PPR");
    expect(result.metadata.slate).toBe("SUNDAY_AFTERNOON");
    expect(result.rows).toHaveLength(48);
    expect(result.rows[0].playerName).toBe("Jahmyr Gibbs");
    expect(result.rows[5].playerName).toBe("De'Von Achane");
  });

  it("parses short rows with optional values omitted", () => {
    const raw = `[FANTASYTRACK_IMPORT]
sport: NFL
1 | Jahmyr Gibbs | DET | NO | RB
[/FANTASYTRACK_IMPORT]`;
    const result = parseFantasyTrackImport(raw);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].depthRole).toBeNull();
    expect(result.rows[0].projectedPoints).toBeNull();
    expect(result.rows[0].status).toBeNull();
    expect(result.rows[0].notes).toBeNull();
  });

  it("errors on missing opening tag", () => {
    const result = parseFantasyTrackImport("1 | A | DET | NO | RB\n[/FANTASYTRACK_IMPORT]");
    expect(result.errors.some((e) => e.code === "MISSING_OPEN_TAG")).toBe(true);
  });

  it("errors on missing closing tag", () => {
    const result = parseFantasyTrackImport(
      "[FANTASYTRACK_IMPORT]\n1 | A | DET | NO | RB"
    );
    expect(result.errors.some((e) => e.code === "MISSING_CLOSE_TAG")).toBe(true);
  });

  it("preserves apostrophes and hyphenated names", () => {
    const raw = `[FANTASYTRACK_IMPORT]
1 | De'Von Achane | MIA | LV | RB | RB1 | 15.9 | ACTIVE | Dual-threat
2 | D'Andre Swift | CHI | CAR | RB | RB1 | 13.0 | ACTIVE | Lead
3 | Ja'Marr-Style Back | CIN | TB | RB | RB1 | 10.0 | ACTIVE | Test
[/FANTASYTRACK_IMPORT]`;
    const result = parseFantasyTrackImport(raw);
    expect(result.rows[0].playerName).toBe("De'Von Achane");
    expect(result.rows[1].playerName).toBe("D'Andre Swift");
    expect(result.rows[2].playerName).toContain("-");
  });

  it("ignores empty lines", () => {
    const raw = `[FANTASYTRACK_IMPORT]

1 | A | DET | NO | RB

2 | B | ATL | PIT | RB

[/FANTASYTRACK_IMPORT]`;
    expect(parseFantasyTrackImport(raw).rows).toHaveLength(2);
  });

  it("folds extra pipes into notes", () => {
    const raw = `[FANTASYTRACK_IMPORT]
1 | Player | DET | NO | RB | RB1 | 10 | ACTIVE | Lead | extra | bits
[/FANTASYTRACK_IMPORT]`;
    const result = parseFantasyTrackImport(raw);
    expect(result.rows[0].notes).toBe("Lead | extra | bits");
  });

  it("flags invalid projected points", () => {
    const raw = `[FANTASYTRACK_IMPORT]
1 | Player | DET | NO | RB | RB1 | abc | ACTIVE | Note
[/FANTASYTRACK_IMPORT]`;
    const result = parseFantasyTrackImport(raw);
    expect(result.errors.some((e) => e.code === "INVALID_PROJECTED_POINTS")).toBe(true);
  });

  it("warns on unknown metadata values", () => {
    const raw = `[FANTASYTRACK_IMPORT]
contestType: WEIRD_TYPE
scoring: SUPER_PPR
1 | Player | DET | NO | RB
[/FANTASYTRACK_IMPORT]`;
    const result = parseFantasyTrackImport(raw);
    expect(result.warnings.some((w) => w.code === "UNKNOWN_METADATA_VALUE")).toBe(true);
  });
});

describe("validateFantasyTrackImport", () => {
  it("flags duplicate ranks and players", () => {
    const raw = `[FANTASYTRACK_IMPORT]
1 | Player One | DET | NO | RB | RB1 | 10 | ACTIVE | A
1 | Player Two | ATL | PIT | RB | RB1 | 9 | ACTIVE | B
2 | Player One | CHI | CAR | RB | RB1 | 8 | ACTIVE | C
[/FANTASYTRACK_IMPORT]`;
    const parsed = parseFantasyTrackImport(raw);
    const validated = validateFantasyTrackImport(parsed);
    expect(validated.errors.some((e) => e.code === "DUPLICATE_RANK")).toBe(true);
    expect(validated.errors.some((e) => e.code === "DUPLICATE_PLAYER")).toBe(true);
    expect(canImport(validated.errors)).toBe(false);
  });

  it("errors when team equals opponent", () => {
    const raw = `[FANTASYTRACK_IMPORT]
1 | Player | DET | DET | RB
[/FANTASYTRACK_IMPORT]`;
    const validated = validateFantasyTrackImport(parseFantasyTrackImport(raw));
    expect(validated.errors.some((e) => e.code === "TEAM_EQUALS_OPPONENT")).toBe(true);
  });

  it("warns on questionable players", () => {
    const validated = validateFantasyTrackImport(
      parseFantasyTrackImport(`[FANTASYTRACK_IMPORT]
1 | Bucky Irving | TB | CIN | RB | RB1 | 12.3 | QUESTIONABLE | Shoulder
[/FANTASYTRACK_IMPORT]`)
    );
    expect(validated.warnings.some((w) => w.code === "NON_ACTIVE_STATUS")).toBe(true);
    expect(canImport(validated.errors)).toBe(true);
  });

  it("validates the sample fixture as importable", () => {
    const validated = validateFantasyTrackImport(
      parseFantasyTrackImport(WEEK1_RB_SAMPLE_IMPORT),
      null,
      { expectedRoles: ["RB1", "RB2"] }
    );
    expect(validated.summary.parsedCount).toBe(48);
    expect(validated.summary.teamCount).toBe(24);
    expect(validated.summary.roleCounts.RB1).toBe(24);
    expect(validated.summary.roleCounts.RB2).toBe(24);
    expect(canImport(validated.errors)).toBe(true);
  });

  it("warns when import metadata differs from contest", () => {
    const validated = validateFantasyTrackImport(
      parseFantasyTrackImport(WEEK1_RB_SAMPLE_IMPORT),
      {
        contestType: "SINGLE_GAME",
        sport: "FOOTBALL",
        season: 2025,
        week: 2,
        scoringFormat: "STANDARD",
        slate: "PRIME_TIME",
      }
    );
    expect(validated.warnings.some((w) => w.code === "METADATA_MISMATCH")).toBe(true);
  });
});

describe("normalizePlayerName", () => {
  it("normalizes curly apostrophes and whitespace", () => {
    expect(normalizePlayerName("  De’Von   Achane ")).toBe("de'von achane");
  });
});

describe("canImport guard", () => {
  it("refuses import when blocking errors exist", () => {
    expect(
      canImport([{ severity: "error", message: "bad", code: "X" }])
    ).toBe(false);
    expect(
      canImport([{ severity: "warning", message: "ok", code: "Y" }])
    ).toBe(true);
  });
});
