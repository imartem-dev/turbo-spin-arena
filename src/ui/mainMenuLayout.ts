export type MainMenuStageLayout = {
  scale: number;
  left: number;
  top: number;
};

export const mainMenuLogicalSize = { width: 720, height: 360 } as const;

export function computeMainMenuStageLayout(viewportWidth: number, viewportHeight: number): MainMenuStageLayout {
  const safeWidth = Math.max(1, viewportWidth);
  const safeHeight = Math.max(1, viewportHeight);
  const scale = Math.min(
    safeWidth / mainMenuLogicalSize.width,
    safeHeight / mainMenuLogicalSize.height,
  );
  return {
    scale,
    left: (safeWidth - mainMenuLogicalSize.width * scale) / 2,
    top: (safeHeight - mainMenuLogicalSize.height * scale) / 2,
  };
}

export function applyMainMenuStageLayout(stage: HTMLElement, viewportWidth: number, viewportHeight: number): void {
  const layout = computeMainMenuStageLayout(viewportWidth, viewportHeight);
  stage.style.left = `${layout.left}px`;
  stage.style.top = `${layout.top}px`;
  stage.style.transform = `scale(${layout.scale})`;
  stage.style.setProperty("--main-menu-scale", String(layout.scale));
}
