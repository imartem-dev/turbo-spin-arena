import * as THREE from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LevelUpVfx, levelUpVfxDuration } from "./levelUpVfx";

function installCanvasMock(): void {
  vi.stubGlobal("document", {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        createRadialGradient: () => ({
          addColorStop: vi.fn(),
        }),
        fillRect: vi.fn(),
        fillStyle: "",
      }),
    }),
  });
}

describe("level up VFX", () => {
  beforeEach(() => {
    installCanvasMock();
    vi.spyOn(THREE.TextureLoader.prototype, "load").mockReturnValue(new THREE.Texture());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps the full motion duration", () => {
    expect(levelUpVfxDuration).toBe(2.55);
  });

  it("reports active playback until the effect completes", () => {
    const vfx = new LevelUpVfx();
    const target = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: "#ffffff" }),
    );
    const camera = new THREE.PerspectiveCamera();

    expect(vfx.isActive()).toBe(false);
    vfx.triggerPowerUp(target, false);
    expect(vfx.isActive()).toBe(true);

    vfx.update(levelUpVfxDuration + 0.1, camera);
    expect(vfx.isActive()).toBe(false);

    vfx.dispose();
    target.geometry.dispose();
    const material = target.material;
    if (Array.isArray(material)) {
      for (const item of material) item.dispose();
    } else {
      material.dispose();
    }
  });

  it("adds a glow shell without replacing the target material", () => {
    const vfx = new LevelUpVfx();
    const material = new THREE.MeshBasicMaterial({ color: "#ffffff" });
    material.onBeforeCompile = vi.fn();
    const target = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);

    vfx.triggerPowerUp(target, false);

    expect(target.material).toBe(material);
    expect(target.children).toHaveLength(1);
    expect(target.children[0].userData.levelUpGlowShell).toBe(true);

    vfx.reset();

    expect(target.material).toBe(material);
    expect(target.children).toHaveLength(0);

    vfx.dispose();
    target.geometry.dispose();
    material.dispose();
  });
});
