import * as THREE from "three";
import type { ArenaDefinition } from "./bowlArena";

const radiusX = 18;
const radiusZ = 13;
const depth = 5.5;
const rings = 56;
const segments = 160;

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
  const group = new THREE.Group();
  group.name = "Deathmatch Skate Pool";
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const surfaceColor = new THREE.Color();
  for (let ring = 0; ring <= rings; ring += 1) {
    const ratio = ring / rings;
    for (let segment = 0; segment < segments; segment += 1) {
      const angle = segment / segments * Math.PI * 2;
      const x = Math.cos(angle) * radiusX * ratio;
      const z = Math.sin(angle) * radiusZ * ratio;
      positions.push(x, getHeightAt(x, z), z);
      surfaceColor.setHSL(0.51, 0.24, THREE.MathUtils.lerp(0.22, 0.52, ratio));
      colors.push(surfaceColor.r, surfaceColor.g, surfaceColor.b);
      uvs.push(x / (radiusX * 2) + 0.5, z / (radiusZ * 2) + 0.5);
    }
  }
  for (let ring = 0; ring < rings; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const next = (segment + 1) % segments;
      const row = ring * segments;
      const nextRow = (ring + 1) * segments;
      indices.push(row + segment, row + next, nextRow + segment, row + next, nextRow + next, nextRow + segment);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const surface = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: "#ffffff", vertexColors: true }));
  surface.userData.arenaSurface = true;
  surface.name = "Deathmatch Pool Surface";
  group.add(surface);

  const rimCurve = new THREE.CatmullRomCurve3(Array.from({ length: 65 }, (_, index) => {
    const angle = index / 64 * Math.PI * 2;
    return new THREE.Vector3(Math.cos(angle) * radiusX, 0.22, Math.sin(angle) * radiusZ);
  }), true);
  group.add(new THREE.Mesh(
    new THREE.TubeGeometry(rimCurve, 256, 0.18, 8, true),
    new THREE.MeshBasicMaterial({ color: "#e8d8b4" }),
  ));
  const outer = new THREE.Mesh(
    new THREE.CircleGeometry(40, 128),
    new THREE.MeshBasicMaterial({ color: "#263933", side: THREE.DoubleSide }),
  );
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -5.72;
  outer.renderOrder = -1;
  group.add(outer);
  return group;
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
};
