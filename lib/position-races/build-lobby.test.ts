import { describe, expect, it } from "vitest";
import { POSITION_RACE_ORDER } from "./types";

describe("position race order", () => {
  it("keeps QB RB WR TE sequence for the lobby grid", () => {
    expect(POSITION_RACE_ORDER).toEqual(["QB", "RB", "WR", "TE"]);
  });
});
