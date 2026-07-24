import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { AuraVfx2 } from "./auraVfx2";
import { AuraVfx3 } from "./auraVfx3";

type AuraPrototype = {
  stop(): void;
  setActiveImmediately(active: boolean): void;
};

function createState(prototype: AuraPrototype): Record<string, unknown> & AuraPrototype {
  const activationUniform = () => ({ uniforms: { u_activation: { value: 1 } } });
  return Object.assign(Object.create(prototype), {
    desiredActive: true,
    activation: 0.7,
    group: Object.assign(new THREE.Group(), { visible: true }),
    auraMaterial: activationUniform(),
    ringMaterial: activationUniform(),
    sparkMaterial: activationUniform(),
    ringCursor: 4,
    ringTimer: 0.5,
    ringBirthTimes: { setX: vi.fn(), needsUpdate: false },
    resourcesReady: true,
  });
}

describe.each([
  ["AuraVfx2", AuraVfx2.prototype],
  ["AuraVfx3", AuraVfx3.prototype],
] as const)("%s activation lifecycle", (_name, prototype) => {
  it("keeps activation available for the normal fade after stop", () => {
    const aura = createState(prototype);
    aura.stop();

    expect(aura.desiredActive).toBe(false);
    expect(aura.activation).toBe(0.7);
    expect((aura.group as THREE.Group).visible).toBe(true);
  });

  it("clears visibility, uniforms, and pooled rings for an immediate stop", () => {
    const aura = createState(prototype);
    aura.setActiveImmediately(false);

    expect(aura.desiredActive).toBe(false);
    expect(aura.activation).toBe(0);
    expect((aura.group as THREE.Group).visible).toBe(false);
    expect(aura.ringCursor).toBe(0);
    expect(aura.ringTimer).toBe(0);
    expect((aura.ringBirthTimes as { needsUpdate: boolean }).needsUpdate).toBe(true);
    expect((aura.auraMaterial as { uniforms: { u_activation: { value: number } } }).uniforms.u_activation.value).toBe(0);
  });
});
