import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { deathmatchArena } from "./deathmatchArena";

describe("deathmatch arena gameplay geometry", () => {
  it("preserves the 18 by 13 bowl height profile", () => {
    expect(deathmatchArena.radius).toBe(18);
    expect(deathmatchArena.getHeightAt(0, 0)).toBeCloseTo(-5.5, 6);
    expect(deathmatchArena.getHeightAt(18, 0)).toBeCloseTo(0.16, 6);
    expect(deathmatchArena.getHeightAt(0, 13)).toBeCloseTo(0.16, 6);
  });

  it("preserves containment and clamps points to the ellipse", () => {
    expect(deathmatchArena.contains(new THREE.Vector3(17.9, 0, 0))).toBe(true);
    expect(deathmatchArena.contains(new THREE.Vector3(0, 0, 13.1))).toBe(false);

    const clamped = deathmatchArena.clampPoint(new THREE.Vector3(36, 7, 0));
    expect(clamped.x).toBeCloseTo(18, 6);
    expect(clamped.z).toBeCloseTo(0, 6);
    expect(clamped.y).toBeCloseTo(deathmatchArena.getHeightAt(clamped.x, clamped.z), 6);
  });

  it("keeps the player and all nine bot spawns inside the arena", () => {
    expect(deathmatchArena.enemySpawns).toHaveLength(9);
    for (const spawn of [deathmatchArena.playerStart, ...deathmatchArena.enemySpawns]) {
      expect(deathmatchArena.contains(spawn)).toBe(true);
      expect(spawn.y).toBeCloseTo(deathmatchArena.getHeightAt(spawn.x, spawn.z), 6);
    }
  });
});
