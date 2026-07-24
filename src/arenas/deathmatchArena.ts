import * as THREE from "three";
import type { ArenaDefinition } from "./bowlArena";
import {
  createDeathmatchArenaVisuals,
  type DeathmatchArenaVisuals,
} from "./deathmatchArenaVisuals";

const radiusX = 18;
const radiusZ = 13;
const depth = 5.5;
const rings = 56;
const segments = 160;
let arenaVisuals: DeathmatchArenaVisuals | null = null;

function normalizedRadius(x: number, z: number): number {
  return Math.hypot(x / radiusX, z / radiusZ);
}

function getHeightAt(x: number, z: number): number {
  const ratio = THREE.MathUtils.clamp(normalizedRadius(x, z), 0, 1);
  return -depth * (1 - ratio ** 2.15) + THREE.MathUtils.smoothstep(ratio, 0.82, 1) * 0.16;
}

function point(x: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(x, getHeightAt(x, z), z);
}

function contains(position: THREE.Vector3, margin = 0): boolean {
  return Math.hypot(position.x / (radiusX + margin), position.z / (radiusZ + margin)) <= 1;
}

function clampPoint(position: THREE.Vector3, margin = 0): THREE.Vector3 {
  const result = position.clone();
  const xLimit = Math.max(0.1, radiusX - margin);
  const zLimit = Math.max(0.1, radiusZ - margin);
  const ratio = Math.hypot(result.x / xLimit, result.z / zLimit);
  if (ratio > 1) {
    result.x /= ratio;
    result.z /= ratio;
  }
  result.y = getHeightAt(result.x, result.z);
  return result;
}

function getBoundaryPoint(position: THREE.Vector3): THREE.Vector3 {
  const result = position.clone();
  const ratio = normalizedRadius(result.x, result.z);
  if (ratio <= 0.000001) result.set(radiusX, 0, 0);
  else {
    result.x /= ratio;
    result.z /= ratio;
  }
  result.y = getHeightAt(result.x, result.z);
  return result;
}

function createSceneObjects(): THREE.Group {
  arenaVisuals = createDeathmatchArenaVisuals({ radiusX, radiusZ, rings, segments, getHeightAt });
  return arenaVisuals.group;
}

const enemySpawns = Array.from({ length: 9 }, (_, index) => {
  const angle = index / 9 * Math.PI * 2;
  return point(Math.cos(angle) * 10.5, Math.sin(angle) * 7.3);
});

export const deathmatchArena: ArenaDefinition = {
  id: "deathmatch",
  radius: radiusX,
  playerStart: point(-11.5, 0),
  enemySpawns,
  interestPoints: [point(0, 0), point(7, 0), point(-7, 0), point(0, 5), point(0, -5), point(6, 4), point(-6, -4)],
  getHeightAt,
  contains,
  clampPoint,
  getBoundaryPoint,
  createSceneObjects,
  updateVisuals: (_deltaTime, elapsedTime, reducedMotion) => {
    arenaVisuals?.update(elapsedTime, reducedMotion);
  },
};
