import { describe, expect, it } from "vitest";
import { getDuelWinnerCoastVelocityScale } from "./movement";

describe("duel winner presentation", () => {
  it("preserves motion while applying predictable coast damping", () => {
    expect(getDuelWinnerCoastVelocityScale(0)).toBe(1);
    expect(getDuelWinnerCoastVelocityScale(0.5)).toBeGreaterThan(0);
    expect(getDuelWinnerCoastVelocityScale(0.5)).toBeLessThan(1);
    expect(getDuelWinnerCoastVelocityScale(1)).toBeLessThan(getDuelWinnerCoastVelocityScale(0.5));
  });
});
