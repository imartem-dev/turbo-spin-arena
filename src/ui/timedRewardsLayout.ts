export const timedRewardsWindowLogicalSize = { width: 500, height: 485 } as const;
export const timedRewardsWindowHeightRatio = 0.9;
export const timedRewardsWindowSideMargin = 16;

export function computeTimedRewardsWindowScale(viewportWidth: number, viewportHeight: number): number {
  const safeWidth = Math.max(1, viewportWidth);
  const safeHeight = Math.max(1, viewportHeight);
  const heightScale = safeHeight * timedRewardsWindowHeightRatio / timedRewardsWindowLogicalSize.height;
  const widthScale = Math.max(1, safeWidth - timedRewardsWindowSideMargin * 2)
    / timedRewardsWindowLogicalSize.width;
  return Math.min(heightScale, widthScale);
}

export function applyTimedRewardsWindowLayout(
  windowElement: HTMLElement,
  viewportWidth: number,
  viewportHeight: number,
): void {
  const scale = computeTimedRewardsWindowScale(viewportWidth, viewportHeight);
  windowElement.style.setProperty("--timed-rewards-scale", String(scale));
}
