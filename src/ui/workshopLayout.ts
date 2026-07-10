export type WorkshopStageLayout = {
  scale: number;
  left: number;
  top: number;
};

export const workshopLogicalRects = {
  header: { x: 8, y: 8, width: 704, height: 40 },
  preview: { x: 8, y: 56, width: 264, height: 232 },
  play: { x: 50, y: 296, width: 180, height: 48 },
  tabs: { x: 280, y: 56, width: 432, height: 40 },
  panel: { x: 276, y: 101, width: 440, height: 254 },
  panelInner: { x: 284, y: 108, width: 424, height: 240 },
  categorySlots: { x: 284, y: 108, width: 68, height: 240 },
  categoryContent: { x: 359, y: 108, width: 349, height: 240 },
} as const;

export const workshopPolishMetrics = {
  panelInsetX: 8,
  panelInsetY: 7,
  panelInnerWidth: 424,
  panelInnerHeight: 240,
  innerGap: 7,
  categorySlotWidth: 68,
  categorySlotHeight: (240 - 4 * 7) / 5,
  categoryContentWidth: 349,
  catalogCardWidth: (349 - 7) / 2,
  catalogCardHeight: (240 - 7) / 2,
  materialSlotWidth: (349 - 2 * 7) / 3,
  paletteHeight: 169,
  paletteVerticalOffset: (240 - 169) / 2,
  paletteCellWidth: (349 - 5 * 7) / 6,
  paletteCellHeight: (169 - 2 * 7) / 3,
  upgradeCardWidth: (424 - 7) / 2,
  upgradeCardHeight: (240 - 7) / 2,
  priceBadgeHeight: 24,
  priceBadgeInset: 7,
} as const;

export function computeWorkshopStageLayout(viewportWidth: number, viewportHeight: number): WorkshopStageLayout {
  const safeWidth = Math.max(1, viewportWidth);
  const safeHeight = Math.max(1, viewportHeight);
  const scale = Math.min(safeWidth / 720, safeHeight / 360);
  return {
    scale,
    left: (safeWidth - 720 * scale) / 2,
    top: (safeHeight - 360 * scale) / 2,
  };
}

export function applyWorkshopStageLayout(stage: HTMLElement, viewportWidth: number, viewportHeight: number): void {
  const layout = computeWorkshopStageLayout(viewportWidth, viewportHeight);
  stage.style.left = `${layout.left}px`;
  stage.style.top = `${layout.top}px`;
  stage.style.transform = `scale(${layout.scale})`;
  stage.style.setProperty("--workshop-scale", String(layout.scale));
}

export function computeWorkshopCanvasPixelRatio(stageScale: number, devicePixelRatio: number): number {
  return Math.min(3, Math.max(1, stageScale * Math.max(1, devicePixelRatio)));
}
