import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";

vi.mock("./auraVfx2", async () => {
  const THREE = await import("three");
  return {
    AuraVfx2: class {
      readonly group = Object.assign(new THREE.Group(), { name: "AuraVFX_2" });
      readonly ready = Promise.resolve();
      get active(): boolean { return this.group.userData.active === true; }
      start(): void { this.group.userData.active = true; this.group.visible = true; }
      stop(): void { this.group.userData.active = false; }
      setActiveImmediately(active: boolean): void {
        this.group.userData.active = active;
        this.group.visible = active;
      }
      setColor(): void {}
      update(): void {}
      setDepthContext(): void {}
      dispose(): void {}
    },
  };
});

vi.mock("./auraVfx3", async () => {
  const THREE = await import("three");
  return {
    AuraVfx3: class {
      readonly group = Object.assign(new THREE.Group(), { name: "AuraVFX_3" });
      readonly ready = Promise.resolve();
      get active(): boolean { return this.group.userData.active === true; }
      start(): void { this.group.userData.active = true; this.group.visible = true; }
      stop(): void { this.group.userData.active = false; }
      setActiveImmediately(active: boolean): void {
        this.group.userData.active = active;
        this.group.visible = active;
      }
      setColor(): void {}
      update(): void {}
      setDepthContext(): void {}
      dispose(): void {}
    },
  };
});

vi.mock("../tornadoVfx", async () => {
  const THREE = await import("three");
  return {
    TornadoVfx: class {
      readonly group = Object.assign(new THREE.Group(), { name: "AuraVFX_1" });
      applyPreset(): void {}
      update(): void {}
      projectGroundToSurface(): void {}
      dispose(): void {}
    },
  };
});

import { createTintedCritAuraPreset, SelectableCosmeticAuraVfx } from "./cosmeticAuraVfx";

describe("cosmetic aura tinting", () => {
  it("recolors the current crit aura without changing its enabled parts", () => {
    const preset = createTintedCritAuraPreset("#00c853");

    expect(preset.enabled?.arcs).toBe(true);
    expect(preset.layers?.arcs?.color).toBe("#00c853");
    expect(preset.layers?.arcs?.accentColor).not.toBe("#00c853");
  });

  it("immediately removes the previous form while switching 1 -> 2 -> 3 -> 1", () => {
    const aura = new SelectableCosmeticAuraVfx();
    const child = (name: string) => aura.group.children.find((item) => item.name === name) as THREE.Group;

    aura.setActive(true);
    expect(child("AuraVFX_1").visible).toBe(true);

    aura.setStyle("aura_2");
    expect(child("AuraVFX_1").visible).toBe(false);
    expect(child("AuraVFX_2").visible).toBe(true);

    aura.setStyle("aura_3");
    expect(child("AuraVFX_2").visible).toBe(false);
    expect(child("AuraVFX_3").visible).toBe(true);

    aura.setStyle("aura_1");
    expect(child("AuraVFX_3").visible).toBe(false);
    expect(child("AuraVFX_1").visible).toBe(true);
  });
});
