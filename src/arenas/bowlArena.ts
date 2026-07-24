import * as THREE from "three";
import backgroundTextureUrl from "../img/backgroundTexture_test.webp";
import rimTextureUrl from "../img/rimTexture_test.webp";
import tileTextureUrl from "../img/tileTexture_test.webp";
import arenaTextureUrl from "../img/texture_test.webp";

export type ArenaDefinition = {
  id: "duel" | "deathmatch";
  radius: number;
  playerStart: THREE.Vector3;
  enemySpawns: THREE.Vector3[];
  interestPoints: THREE.Vector3[];
  getHeightAt(x: number, z: number): number;
  contains(position: THREE.Vector3, margin?: number): boolean;
  clampPoint(position: THREE.Vector3, margin?: number): THREE.Vector3;
  getBoundaryPoint(position: THREE.Vector3): THREE.Vector3;
  createSceneObjects(): THREE.Group;
  updateVisuals?(deltaTime: number, elapsedTime: number, reducedMotion: boolean): void;
};

export type ArenaTextureSettings = {
  offsetX: number;
  offsetY: number;
  scale: number;
  rotation: number;
};

export type TileTextureSettings = ArenaTextureSettings;
export type BackdropTextureSettings = ArenaTextureSettings;

const arenaRadius = 10;
const defaultBowlDepth = 4.2;
let bowlDepth = defaultBowlDepth;
const rimLift = 0.12;
const bowlSegments = 128;
const bowlRings = 48;
const rimSegments = 192;
const backdropSegments = 96;
const useTextureTest = true;
const useTileTextureTest = true;
const arenaTextureSettings: ArenaTextureSettings = {
  offsetX: 0,
  offsetY: 0,
  scale: 1,
  rotation: Math.PI,
};
const tileTextureSettings: TileTextureSettings = {
  offsetX: -1,
  offsetY: -0.41,
  scale: 0.2,
  rotation: -Math.PI,
};
const backdropTextureSettings: BackdropTextureSettings = {
  offsetX: -0.04,
  offsetY: 0.06,
  scale: 0.86,
  rotation: 0,
};
const rimSurfaceTexture = new THREE.TextureLoader().load(rimTextureUrl);
const backdropTexture = new THREE.TextureLoader().load(backgroundTextureUrl);
const tileSurfaceTexture = useTileTextureTest ? new THREE.TextureLoader().load(tileTextureUrl) : null;
const bowlSurfaceTexture = useTextureTest ? new THREE.TextureLoader().load(arenaTextureUrl) : null;

rimSurfaceTexture.colorSpace = THREE.SRGBColorSpace;
rimSurfaceTexture.wrapS = THREE.RepeatWrapping;
rimSurfaceTexture.wrapT = THREE.ClampToEdgeWrapping;

backdropTexture.colorSpace = THREE.SRGBColorSpace;
backdropTexture.wrapS = THREE.ClampToEdgeWrapping;
backdropTexture.wrapT = THREE.ClampToEdgeWrapping;
applyBackdropTextureSettings();

if (tileSurfaceTexture) {
  tileSurfaceTexture.colorSpace = THREE.SRGBColorSpace;
  tileSurfaceTexture.wrapS = THREE.RepeatWrapping;
  tileSurfaceTexture.wrapT = THREE.RepeatWrapping;
  applyTileTextureSettings();
}

if (bowlSurfaceTexture) {
  bowlSurfaceTexture.colorSpace = THREE.SRGBColorSpace;
  applyArenaTextureSettings();
}

export const duelArena: ArenaDefinition = {
  id: "duel",
  radius: arenaRadius,
  playerStart: pointOnArena(-1.7, 0.75),
  enemySpawns: [
    pointOnArena(2.4, 0),
    pointOnArena(-2.2, -1.8),
    pointOnArena(0.9, 2.6),
    pointOnArena(-3.1, 1.8),
    pointOnArena(3.2, -1.5),
    pointOnArena(0, -3.2),
  ],
  interestPoints: [
    pointOnArena(0, 0),
    pointOnArena(4.2, 0),
    pointOnArena(-4.2, 0),
    pointOnArena(0, 4.2),
    pointOnArena(0, -4.2),
  ],
  getHeightAt: getArenaHeightAt,
  contains: containsDuelPoint,
  clampPoint: clampDuelPoint,
  getBoundaryPoint: getDuelBoundaryPoint,
  createSceneObjects,
};

export let activeArena: ArenaDefinition = duelArena;

export function setActiveArena(arena: ArenaDefinition): void {
  activeArena = arena;
}

export function getActiveArenaHeight(position: THREE.Vector3): number {
  return getArenaSurfaceHeight(position);
}

export function projectToArenaSurface(position: THREE.Vector3, offsetY = 0): THREE.Vector3 {
  const projected = activeArena.clampPoint(position);
  projected.y = activeArena.getHeightAt(projected.x, projected.z) + offsetY;
  return projected;
}

export function getArenaSurfaceHeight(position: THREE.Vector3): number {
  if (!isOutsideArena(position)) {
    return activeArena.getHeightAt(position.x, position.z);
  }

  const edgePoint = getArenaEdgePoint(position);
  return activeArena.getHeightAt(edgePoint.x, edgePoint.z);
}

export function getArenaEdgePoint(position: THREE.Vector3): THREE.Vector3 {
  return projectToArenaSurface(activeArena.getBoundaryPoint(position));
}

export function isOutsideArena(position: THREE.Vector3, margin = 0): boolean {
  return !activeArena.contains(position, margin);
}

export function clampToActiveArena(position: THREE.Vector3, margin = 0): THREE.Vector3 {
  return projectToArenaSurface(activeArena.clampPoint(position, margin));
}

export function getBowlDepth(): number {
  return bowlDepth;
}

export function setBowlDepth(depth: number): void {
  bowlDepth = THREE.MathUtils.clamp(depth, 0, 4.2);
}

export function getArenaTextureSettings(): ArenaTextureSettings {
  return { ...arenaTextureSettings };
}

export function setArenaTextureSetting(key: keyof ArenaTextureSettings, value: number): void {
  arenaTextureSettings[key] = value;
  applyArenaTextureSettings();
}

export function setTileTextureSetting(key: keyof TileTextureSettings, value: number): void {
  tileTextureSettings[key] = value;
  applyTileTextureSettings();
}

export function setBackdropTextureSetting(key: keyof BackdropTextureSettings, value: number): void {
  backdropTextureSettings[key] = value;
  applyBackdropTextureSettings();
}

export function rebuildActiveArenaSceneObjects(group: THREE.Group): void {
  disposeArenaChildren(group);
  group.add(createBackdrop());
  group.add(createGroundBand());
  group.add(createBowlSurface());
  group.add(createArenaRim());
  if (!useTextureTest) {
    group.add(createArenaMarks());
  }
}

function pointOnArena(x: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(x, getArenaHeightAt(x, z), z);
}

function containsDuelPoint(position: THREE.Vector3, margin = 0): boolean {
  return Math.hypot(position.x, position.z) <= arenaRadius + margin;
}

function clampDuelPoint(position: THREE.Vector3, margin = 0): THREE.Vector3 {
  const result = position.clone();
  const limit = Math.max(0, arenaRadius - margin);
  const distance = Math.hypot(result.x, result.z);
  if (distance > limit && distance > 0.000001) {
    result.x *= limit / distance;
    result.z *= limit / distance;
  }
  result.y = getArenaHeightAt(result.x, result.z);
  return result;
}

function getDuelBoundaryPoint(position: THREE.Vector3): THREE.Vector3 {
  const result = position.clone();
  const distance = Math.hypot(result.x, result.z);
  if (distance <= 0.000001) result.set(arenaRadius, 0, 0);
  else {
    result.x *= arenaRadius / distance;
    result.z *= arenaRadius / distance;
  }
  result.y = getArenaHeightAt(result.x, result.z);
  return result;
}

function getArenaHeightAt(x: number, z: number): number {
  const radiusRatio = THREE.MathUtils.clamp(Math.hypot(x, z) / arenaRadius, 0, 1);
  const bowlCurve = 1 - radiusRatio ** 2.25;
  const edgeRamp = smoothstep(0.78, 1, radiusRatio);
  const subtleUnevenness = Math.sin(x * 0.55 + z * 0.18) * Math.sin(z * 0.42 - x * 0.11) * 0.018 * (1 - radiusRatio);
  return -bowlDepth * bowlCurve + rimLift * edgeRamp + subtleUnevenness;
}

function createSceneObjects(): THREE.Group {
  const group = new THREE.Group();
  group.name = "Garden Bowl Arena";

  rebuildActiveArenaSceneObjects(group);

  return group;
}

function disposeArenaChildren(group: THREE.Group): void {
  for (const child of [...group.children]) {
    group.remove(child);
    child.traverse((object) => {
      const renderable = object as THREE.Object3D & {
        geometry?: THREE.BufferGeometry;
        material?: THREE.Material | THREE.Material[];
      };
      renderable.geometry?.dispose();
      if (renderable.material) {
        disposeMaterial(renderable.material);
      }
    });
  }
}

function disposeMaterial(material: THREE.Material | THREE.Material[]): void {
  const materials = Array.isArray(material) ? material : [material];
  for (const item of materials) {
    item.dispose();
  }
}

function createGroundBand(): THREE.Group {
  const group = new THREE.Group();
  const groundBand = new THREE.Mesh(
    new THREE.RingGeometry(arenaRadius * 1.08, 64, 256),
    new THREE.MeshBasicMaterial({
      color: useTileTextureTest ? "#ffffff" : "#9fbd66",
      map: tileSurfaceTexture,
      side: THREE.DoubleSide,
    }),
  );
  groundBand.rotation.x = -Math.PI / 2;
  groundBand.position.y = getArenaHeightAt(arenaRadius, 0) - 0.18;
  group.add(groundBand);

  if (useTileTextureTest) {
    return group;
  }

  const redEarth = new THREE.Mesh(
    new THREE.RingGeometry(arenaRadius * 1.03, arenaRadius * 1.48, 160),
    new THREE.MeshBasicMaterial({
      color: "#9f4d45",
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  redEarth.rotation.x = -Math.PI / 2;
  redEarth.position.y = groundBand.position.y + 0.012;
  group.add(redEarth);

  return group;
}

function createBowlSurface(): THREE.Mesh {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let ring = 0; ring <= bowlRings; ring += 1) {
    const radiusRatio = ring / bowlRings;
    const radius = radiusRatio * arenaRadius;
    for (let segment = 0; segment < bowlSegments; segment += 1) {
      const angle = (segment / bowlSegments) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      positions.push(x, getArenaHeightAt(x, z), z);
      uvs.push(x / (arenaRadius * 2) + 0.5, z / (arenaRadius * 2) + 0.5);
    }
  }

  for (let ring = 0; ring < bowlRings; ring += 1) {
    const row = ring * bowlSegments;
    const nextRow = (ring + 1) * bowlSegments;
    for (let segment = 0; segment < bowlSegments; segment += 1) {
      const nextSegment = (segment + 1) % bowlSegments;
      indices.push(row + segment, row + nextSegment, nextRow + segment);
      indices.push(row + nextSegment, nextRow + nextSegment, nextRow + segment);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: useTextureTest ? "#ffffff" : "#d89b6a",
      map: bowlSurfaceTexture,
    }),
  );
  mesh.name = "Arena Surface";
  mesh.userData.arenaSurface = true;
  return mesh;
}

function applyArenaTextureSettings(): void {
  if (!bowlSurfaceTexture) {
    return;
  }

  const safeScale = 1 / Math.max(arenaTextureSettings.scale, 0.01);
  bowlSurfaceTexture.center.set(0.5, 0.5);
  bowlSurfaceTexture.offset.set(arenaTextureSettings.offsetX, arenaTextureSettings.offsetY);
  bowlSurfaceTexture.repeat.set(safeScale, safeScale);
  bowlSurfaceTexture.rotation = arenaTextureSettings.rotation;
}

function applyTileTextureSettings(): void {
  if (!tileSurfaceTexture) {
    return;
  }

  const safeScale = 1 / Math.max(tileTextureSettings.scale, 0.01);
  tileSurfaceTexture.center.set(0.5, 0.5);
  tileSurfaceTexture.offset.set(tileTextureSettings.offsetX, tileTextureSettings.offsetY);
  tileSurfaceTexture.repeat.set(safeScale, safeScale);
  tileSurfaceTexture.rotation = tileTextureSettings.rotation;
}

function applyBackdropTextureSettings(): void {
  const safeScale = 1 / Math.max(backdropTextureSettings.scale, 0.01);
  backdropTexture.center.set(0.5, 0.5);
  backdropTexture.offset.set(backdropTextureSettings.offsetX, backdropTextureSettings.offsetY);
  backdropTexture.repeat.set(safeScale, safeScale);
  backdropTexture.rotation = backdropTextureSettings.rotation;
}

function createArenaRim(): THREE.Group {
  const group = new THREE.Group();
  const rimHeight = getArenaHeightAt(arenaRadius, 0) + 0.05;

  const rim = new THREE.Mesh(
    createProfiledRimGeometry(rimHeight),
    new THREE.MeshBasicMaterial({
      color: "#f5eee1",
      map: rimSurfaceTexture,
    }),
  );
  rim.name = "Arena Profiled Rim";
  group.add(rim);

  const innerGlow = new THREE.Mesh(
    new THREE.TorusGeometry(arenaRadius * 0.982, 0.018, 6, 192),
    new THREE.MeshBasicMaterial({
      color: "#ffffff",
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
  );
  innerGlow.position.y = rimHeight + 0.035;
  innerGlow.rotation.x = Math.PI / 2;
  group.add(innerGlow);

  return group;
}

function createProfiledRimGeometry(baseHeight: number): THREE.BufferGeometry {
  const profile = [
    { radius: 9.72, y: -0.5, v: 0 },
    { radius: 9.72, y: -0.08, v: 0.16 },
    { radius: 9.96, y: 0.07, v: 0.32 },
    { radius: 10.92, y: 0.07, v: 0.64 },
    { radius: 11.08, y: -0.08, v: 0.8 },
    { radius: 11.08, y: -0.42, v: 0.94 },
    { radius: 10.74, y: -0.5, v: 1 },
    { radius: 9.72, y: -0.5, v: 1.18 },
  ];
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const repeatCount = 48;

  for (let segment = 0; segment <= rimSegments; segment += 1) {
    const u = segment / rimSegments;
    const angle = u * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    for (const point of profile) {
      positions.push(cos * point.radius, baseHeight + point.y, sin * point.radius);
      uvs.push(u * repeatCount, point.v);
    }
  }

  for (let segment = 0; segment < rimSegments; segment += 1) {
    const row = segment * profile.length;
    const nextRow = (segment + 1) * profile.length;
    for (let point = 0; point < profile.length - 1; point += 1) {
      indices.push(row + point, nextRow + point, row + point + 1);
      indices.push(row + point + 1, nextRow + point, nextRow + point + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createBackdrop(): THREE.Mesh {
  const radius = 58;
  const minY = -1;
  const maxY = 18;
  const arc = THREE.MathUtils.degToRad(220);
  const startAngle = -Math.PI / 2 - arc / 2;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let segment = 0; segment <= backdropSegments; segment += 1) {
    const ratio = segment / backdropSegments;
    const angle = startAngle + arc * ratio;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    positions.push(x, minY, z, x, maxY, z);
    uvs.push(ratio, 0, ratio, 1);
  }

  for (let segment = 0; segment < backdropSegments; segment += 1) {
    const row = segment * 2;
    const nextRow = (segment + 1) * 2;
    indices.push(row, row + 1, nextRow);
    indices.push(row + 1, nextRow + 1, nextRow);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: "#ffffff",
      map: backdropTexture,
      side: THREE.BackSide,
      depthWrite: false,
    }),
  );
  mesh.name = "Arena Backdrop";
  mesh.renderOrder = -10;
  return mesh;
}

function createArenaMarks(): THREE.Group {
  const group = new THREE.Group();
  const markMaterial = new THREE.LineBasicMaterial({
    color: "#8f6c52",
    transparent: true,
    opacity: 0.28,
  });
  const scuffMaterial = new THREE.LineBasicMaterial({
    color: "#5f4635",
    transparent: true,
    opacity: 0.22,
  });

  group.add(createSurfaceRing(0.78, markMaterial, 0.03));
  group.add(createSurfaceRing(5.9, markMaterial, 0.035));
  group.add(createSurfaceRing(8.35, markMaterial, 0.035));

  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    group.add(createSurfaceLine(angle, 0.95, 9.25, markMaterial, 0.04));
  }

  for (let i = 0; i < 42; i += 1) {
    const angle = seededNoise(i, 0) * Math.PI * 2;
    const distance = 1.2 + seededNoise(i, 1) * 7.2;
    const length = 0.13 + seededNoise(i, 2) * 0.36;
    const center = new THREE.Vector3(Math.cos(angle) * distance, 0, Math.sin(angle) * distance);
    const scuffAngle = angle + Math.PI * 0.5 + (seededNoise(i, 3) - 0.5) * 1.3;
    group.add(createSurfaceScuff(center, scuffAngle, length, scuffMaterial));
  }

  return group;
}

function createSurfaceRing(radius: number, material: THREE.Material, offsetY: number): THREE.LineLoop {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < 160; i += 1) {
    const angle = (i / 160) * Math.PI * 2;
    points.push(projectToArenaSurface(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius), offsetY));
  }
  return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), material);
}

function createSurfaceLine(angle: number, fromRadius: number, toRadius: number, material: THREE.Material, offsetY: number): THREE.Line {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= 36; i += 1) {
    const radius = THREE.MathUtils.lerp(fromRadius, toRadius, i / 36);
    points.push(projectToArenaSurface(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius), offsetY));
  }
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material);
}

function createSurfaceScuff(center: THREE.Vector3, angle: number, length: number, material: THREE.Material): THREE.Line {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= 8; i += 1) {
    const t = i / 8 - 0.5;
    const curve = Math.sin((t + 0.5) * Math.PI) * 0.08;
    const x = center.x + Math.cos(angle) * length * t + Math.cos(angle + Math.PI * 0.5) * curve;
    const z = center.z + Math.sin(angle) * length * t + Math.sin(angle + Math.PI * 0.5) * curve;
    points.push(projectToArenaSurface(new THREE.Vector3(x, 0, z), 0.045));
  }
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function seededNoise(a: number, b: number): number {
  const value = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return value - Math.floor(value);
}
