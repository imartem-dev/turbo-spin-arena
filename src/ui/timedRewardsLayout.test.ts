import { describe, expect, it } from "vitest";
import {
  computeTimedRewardsWindowScale,
  timedRewardsWindowHeightRatio,
  timedRewardsWindowLogicalSize,
} from "./timedRewardsLayout";

describe("timed rewards window layout", () => {
  it.each([
    [720, 360],
    [844, 390],
    [1280, 720],
    [1920, 1080],
  ])("uses 90%% of the viewport height at %sx%s", (width, height) => {
    const scale = computeTimedRewardsWindowScale(width, height);
    expect(timedRewardsWindowLogicalSize.height * scale).toBeCloseTo(height * timedRewardsWindowHeightRatio, 6);
  });

  it("limits the window by the available width on a narrow viewport", () => {
    const scale = computeTimedRewardsWindowScale(300, 720);
    expect(timedRewardsWindowLogicalSize.width * scale).toBeCloseTo(268, 6);
  });
});
