import { describe, expect, it } from "vitest";
import { TornadoVfx, type TornadoVfxPreset } from "../tornadoVfx";
import earthAuraPreset from "./earth_aura-preset.json";

describe("earth ultimate aura", () => {
  it("keeps the black arc layer disabled in the preset and runtime VFX", () => {
    expect(earthAuraPreset.enabled.arcs).toBe(false);

    const vfx = new TornadoVfx(earthAuraPreset as TornadoVfxPreset);
    const arcMeshes = vfx.group.children
      .flatMap((group) => group.children)
      .filter((object) => object.name === "TornadoVfxArcCore" || object.name === "TornadoVfxArcGlow");

    expect(arcMeshes).toHaveLength(2);
    expect(arcMeshes.every((mesh) => mesh.visible === false)).toBe(true);
    vfx.dispose();
  });
});
