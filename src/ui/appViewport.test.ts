import { describe, expect, it } from "vitest";
import { getAppViewport } from "./appViewport";

describe("getAppViewport", () => {
  it("uses the visible browser viewport when mobile browser chrome is open", () => {
    expect(getAppViewport({
      innerWidth: 1280,
      innerHeight: 720,
      visualViewport: { width: 1280, height: 445 },
    })).toEqual({ width: 1280, height: 445 });
  });

  it("falls back to the window dimensions when VisualViewport is unavailable", () => {
    expect(getAppViewport({ innerWidth: 720, innerHeight: 360 })).toEqual({ width: 720, height: 360 });
  });
});
