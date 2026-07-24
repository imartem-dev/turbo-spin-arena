import { describe, expect, it } from "vitest";
import {
  computeWorkshopCanvasPixelRatio,
  computeWorkshopStageLayout,
  workshopLogicalRects,
  workshopPolishMetrics,
} from "./workshopLayout";

describe("workshop 720x360 stage layout", () => {
  it.each([
    [720, 360, 1, 0, 0],
    [960, 540, 4 / 3, 0, 30],
    [1920, 1080, 8 / 3, 0, 60],
  ])("fits %sx%s without reflow", (width, height, scale, left, top) => {
    const layout = computeWorkshopStageLayout(width, height);
    expect(layout.scale).toBeCloseTo(scale, 6);
    expect(layout.left).toBeCloseTo(left, 6);
    expect(layout.top).toBeCloseTo(top, 6);
  });

  it("keeps the specified logical rectangles inside the 720x360 stage", () => {
    expect(workshopLogicalRects.preview).toEqual({ x: 8, y: 56, width: 304, height: 232 });
    expect(workshopLogicalRects.play).toEqual({ x: 8, y: 292.57, width: 260, height: 59.43 });
    expect(workshopLogicalRects.play.x).toBe(8);
    expect(workshopLogicalRects.panel.x - (workshopLogicalRects.play.x + workshopLogicalRects.play.width)).toBe(8);
    expect(360 - (workshopLogicalRects.play.y + workshopLogicalRects.play.height)).toBeCloseTo(8, 6);
    expect(workshopLogicalRects.panel).toEqual({ x: 276, y: 101, width: 440, height: 254 });
    expect(workshopLogicalRects.panelInner).toEqual({ x: 284, y: 108, width: 424, height: 240 });
    expect(workshopLogicalRects.categorySlots).toEqual({ x: 284, y: 108, width: 68, height: 240 });
    expect(workshopLogicalRects.categoryContent).toEqual({ x: 359, y: 108, width: 349, height: 240 });
    expect(workshopLogicalRects.panel.x + workshopLogicalRects.panel.width).toBe(716);
    expect(workshopLogicalRects.panel.y + workshopLogicalRects.panel.height).toBe(355);
  });

  it("raises the WebGL pixel ratio with the visual stage scale", () => {
    expect(computeWorkshopCanvasPixelRatio(1, 1)).toBe(1);
    expect(computeWorkshopCanvasPixelRatio(4 / 3, 1)).toBeCloseTo(4 / 3, 6);
    expect(computeWorkshopCanvasPixelRatio(8 / 3, 1)).toBeCloseTo(8 / 3, 6);
    expect(computeWorkshopCanvasPixelRatio(8 / 3, 2)).toBe(3);
  });

  it("keeps expanded panel padding and shared seven-pixel gaps", () => {
    expect(workshopPolishMetrics.panelInsetX).toBe(8);
    expect(workshopPolishMetrics.panelInsetY).toBe(7);
    expect(workshopLogicalRects.panel.x + workshopPolishMetrics.panelInsetX).toBe(workshopLogicalRects.panelInner.x);
    expect(workshopLogicalRects.panel.y + workshopPolishMetrics.panelInsetY).toBe(workshopLogicalRects.panelInner.y);
    expect(5 * workshopPolishMetrics.categorySlotHeight + 4 * workshopPolishMetrics.innerGap).toBe(240);
    expect(
      workshopPolishMetrics.categorySlotWidth
        + workshopPolishMetrics.innerGap
        + workshopPolishMetrics.categoryContentWidth,
    ).toBe(workshopPolishMetrics.panelInnerWidth);
    expect(2 * workshopPolishMetrics.catalogCardWidth + workshopPolishMetrics.innerGap).toBe(349);
    expect(2 * workshopPolishMetrics.catalogCardHeight + workshopPolishMetrics.innerGap).toBe(240);
    expect(3 * workshopPolishMetrics.materialSlotWidth + 2 * workshopPolishMetrics.innerGap).toBeCloseTo(349, 6);
    expect(6 * workshopPolishMetrics.paletteCellWidth + 5 * workshopPolishMetrics.innerGap).toBeCloseTo(349, 6);
    expect(3 * workshopPolishMetrics.paletteCellHeight + 2 * workshopPolishMetrics.innerGap).toBe(169);
    expect(2 * workshopPolishMetrics.paletteVerticalOffset + workshopPolishMetrics.paletteHeight).toBe(240);
    expect(2 * workshopPolishMetrics.upgradeCardWidth + workshopPolishMetrics.innerGap).toBe(424);
    expect(2 * workshopPolishMetrics.upgradeCardHeight + workshopPolishMetrics.innerGap).toBe(240);
    expect(workshopPolishMetrics.priceBadgeInset + workshopPolishMetrics.priceBadgeHeight).toBeLessThan(
      workshopPolishMetrics.catalogCardHeight,
    );
  });
});
