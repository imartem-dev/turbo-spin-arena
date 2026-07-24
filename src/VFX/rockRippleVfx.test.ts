import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultRockRippleVfxConfig, RockRippleVfxPool } from "./rockRippleVfx";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("rock ripple VFX", () => {
  it("spaces the three rock waves across the earth attack radius", () => {
    expect(defaultRockRippleVfxConfig.ringRadii).toEqual([3.6, 5.2, 7.6]);
  });

  it("does not create the dark ground-crack layer", () => {
    vi.spyOn(THREE.TextureLoader.prototype, "load").mockReturnValue(new THREE.Texture());
    const pool = new RockRippleVfxPool({ poolSize: 1 });
    const objectNames: string[] = [];
    pool.group.traverse((object) => objectNames.push(object.name));

    expect(objectNames).not.toContain("Rock Ripple Ground Cracks");
    expect(objectNames).toContain("Rock Ripple Stones");
    expect(objectNames).toContain("Rock Ripple Dust");

    pool.dispose();
  });
});
