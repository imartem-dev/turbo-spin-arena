import { describe, expect, it } from "vitest";
import { computeMainMenuStageLayout, mainMenuLogicalSize } from "./mainMenuLayout";

describe("main menu 720x360 stage layout", () => {
  it.each([
    [720, 360, 1, 0, 0],
    [960, 540, 4 / 3, 0, 30],
    [1920, 1080, 8 / 3, 0, 60],
    [844, 390, 13 / 12, 32, 0],
    [390, 844, 13 / 24, 0, 324.5],
  ])("fits %sx%s without reflow", (width, height, scale, left, top) => {
    const layout = computeMainMenuStageLayout(width, height);
    expect(layout.scale).toBeCloseTo(scale, 6);
    expect(layout.left).toBeCloseTo(left, 6);
    expect(layout.top).toBeCloseTo(top, 6);
  });

  it("keeps the logical size fixed", () => {
    expect(mainMenuLogicalSize).toEqual({ width: 720, height: 360 });
  });
});
