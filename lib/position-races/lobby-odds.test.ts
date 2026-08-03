import { describe, expect, it } from "vitest";
import { formatLobbyOddsTo1, selectLobbyPreviewOdds } from "./lobby-odds";

describe("selectLobbyPreviewOdds", () => {
  it("prefers live WIN-pool odds when the lane has pool activity", () => {
    const result = selectLobbyPreviewOdds({
      liveWinMultiple: 6,
      winPoolAmount: 100,
      openingWinOddsTo1: 12,
    });
    expect(result.oddsSource).toBe("LIVE");
    expect(result.oddsTo1).toBe(5);
    expect(result.oddsLabel).toBe("Live Odds: 5-1");
    expect(result.oddsEstablished).toBe(true);
  });

  it("falls back to opening odds when there is no WIN-pool activity", () => {
    const result = selectLobbyPreviewOdds({
      liveWinMultiple: null,
      winPoolAmount: 0,
      openingWinOddsTo1: 18,
    });
    expect(result.oddsSource).toBe("OPENING");
    expect(result.oddsTo1).toBe(18);
    expect(result.oddsLabel).toBe("Opening Odds: 18-1");
    expect(result.winMultiple).toBe(19);
  });

  it("does not treat a live multiple as established without pool amount", () => {
    const result = selectLobbyPreviewOdds({
      liveWinMultiple: 4,
      winPoolAmount: 0,
      openingWinOddsTo1: 9,
    });
    expect(result.oddsSource).toBe("OPENING");
    expect(result.oddsLabel).toBe("Opening Odds: 9-1");
  });

  it("returns empty state when neither live nor opening odds exist", () => {
    const result = selectLobbyPreviewOdds({
      liveWinMultiple: null,
      winPoolAmount: 0,
      openingWinOddsTo1: null,
    });
    expect(result).toMatchObject({
      oddsSource: "NONE",
      oddsTo1: null,
      oddsLabel: "Odds not established",
      oddsEstablished: false,
    });
  });
});

describe("formatLobbyOddsTo1", () => {
  it("formats whole-number odds-to-1 as N-1", () => {
    expect(formatLobbyOddsTo1(12)).toBe("12-1");
  });
});
