import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  applyLargeFragmentGroundContact,
  computeFragmentFloorClearance,
  DeathCameraPunch,
  setDirectionalFragmentVelocity,
  SpinnerDeathVfxPool,
  spinnerDeathFragmentNames,
  validateSpinnerDeathFragments,
} from "./spinnerDeathVfx";

function createFragmentSource(): THREE.Group {
  const source = new THREE.Group();
  for (const [fragmentIndex, name] of spinnerDeathFragmentNames.entries()) {
    const fragment = new THREE.Group();
    fragment.name = name;
    fragment.position.x = fragmentIndex * 0.1;
    for (const materialName of ["M_Color_1", "M_Color_2", "M_Base"]) {
      const material = new THREE.MeshBasicMaterial();
      material.name = materialName;
      fragment.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), material));
    }
    source.add(fragment);
  }
  return source;
}

describe("spinner death VFX", () => {
  it("requires exactly fragment_01 through fragment_07", () => {
    const source = createFragmentSource();
    expect(validateSpinnerDeathFragments(source).map((fragment) => fragment.name))
      .toEqual(spinnerDeathFragmentNames);

    source.getObjectByName("fragment_07")?.removeFromParent();
    expect(() => validateSpinnerDeathFragments(source)).toThrow(/fragment_07/);
  });

  it("prewarms 21 instanced fills and caps concurrent effects at 32", () => {
    const scene = new THREE.Scene();
    const pool = new SpinnerDeathVfxPool(scene, () => 0, 32);
    pool.setModelSource(createFragmentSource(), 0, 2);
    expect(pool.getOutlineTargets()).toHaveLength(21);
    expect(pool.getOutlineTargets().every((target) => target instanceof THREE.InstancedMesh)).toBe(true);

    const snapshot = {
      matrixWorld: new THREE.Matrix4(),
      colors: ["#ff0000", "#00ff00", "#0000ff"] as const,
      inheritedVelocity: new THREE.Vector3(),
      impactDirection: new THREE.Vector3(1, 0, 0),
      impactPosition: new THREE.Vector3(),
    };
    for (let index = 0; index < 32; index += 1) expect(pool.play(snapshot, false)).toBe(true);
    expect(pool.play(snapshot, false)).toBe(false);
  });

  it("biases fragment and small-debris travel along the lethal impact", () => {
    const velocity = new THREE.Vector3();
    setDirectionalFragmentVelocity(
      velocity,
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(),
      10,
      3,
      5,
    );
    expect(velocity.dot(new THREE.Vector3(1, 0, 0))).toBeGreaterThan(0);

    const scene = new THREE.Scene();
    const pool = new SpinnerDeathVfxPool(scene, () => 0, 1);
    pool.setModelSource(createFragmentSource(), 0, 2);
    pool.play({
      matrixWorld: new THREE.Matrix4(),
      colors: ["#ff0000", "#00ff00", "#0000ff"],
      inheritedVelocity: new THREE.Vector3(),
      impactDirection: new THREE.Vector3(1, 0, 0),
      impactPosition: new THREE.Vector3(0, 1, 0),
    }, false);
    pool.update(0.15);
    const meshes = [
      scene.getObjectByName("Spinner Death Small Tetra Debris"),
      scene.getObjectByName("Spinner Death Small Wedge Debris"),
    ] as THREE.InstancedMesh[];
    const matrix = new THREE.Matrix4();
    let travelingWithImpact = 0;
    for (const mesh of meshes) {
      expect(mesh.count).toBe(14);
      for (let index = 0; index < mesh.count; index += 1) {
        mesh.getMatrixAt(index, matrix);
        if (new THREE.Vector3().setFromMatrixPosition(matrix).x > 0) travelingWithImpact += 1;
      }
    }
    expect(travelingWithImpact).toBeGreaterThan(20);
  });

  it("uses fragment size for floor clearance and performs exactly two bounces", () => {
    expect(computeFragmentFloorClearance(2, new THREE.Vector3(1, 2, 1))).toBeCloseTo(2.2);
    const motion = {
      position: { y: -1 },
      velocity: { x: 10, y: -10, z: 5 },
      angularSpeed: 20,
      bounceCount: 0,
    };
    applyLargeFragmentGroundContact(motion, 0.5, 1 / 60);
    expect(motion.position.y).toBe(0.5);
    expect(motion.bounceCount).toBe(1);
    motion.position.y = 0;
    motion.velocity.y = -5;
    applyLargeFragmentGroundContact(motion, 0.5, 1 / 60);
    expect(motion.bounceCount).toBe(2);
    motion.position.y = 0;
    motion.velocity.y = -2;
    applyLargeFragmentGroundContact(motion, 0.5, 1 / 60);
    expect(motion.bounceCount).toBe(2);
    expect(motion.velocity.y).toBe(0);
  });

  it("removes camera punch offsets without drift and skips reduced motion", () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(2, 3, 4);
    const baseline = camera.position.clone();
    const punch = new DeathCameraPunch();
    punch.trigger(new THREE.Vector3(1, 0, 0), false);
    punch.updateAndApply(camera, 1 / 60);
    expect(camera.position.equals(baseline)).toBe(false);
    punch.remove(camera);
    expect(camera.position.distanceTo(baseline)).toBeLessThan(0.000001);
    punch.trigger(new THREE.Vector3(1, 0, 0), true);
    punch.updateAndApply(camera, 1 / 60);
    expect(camera.position.distanceTo(baseline)).toBeLessThan(0.000001);
  });
});
