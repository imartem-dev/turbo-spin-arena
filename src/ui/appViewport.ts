export type AppViewport = {
  width: number;
  height: number;
};

type ViewportSource = {
  innerWidth: number;
  innerHeight: number;
  visualViewport?: { width: number; height: number } | null;
};

export function getAppViewport(source: ViewportSource): AppViewport {
  const visualViewport = source.visualViewport;
  return {
    width: Math.max(1, Math.round(visualViewport?.width ?? source.innerWidth)),
    height: Math.max(1, Math.round(visualViewport?.height ?? source.innerHeight)),
  };
}

export function applyAppViewport(root: HTMLElement, viewport: AppViewport): void {
  root.style.setProperty("--app-viewport-width", `${viewport.width}px`);
  root.style.setProperty("--app-viewport-height", `${viewport.height}px`);
}
