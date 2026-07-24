import * as THREE from "three";
import arenaReferenceUrl from "../img/deathmatch/arena-reference-full.webp";

const REFERENCE_CENTER_U = 836 / 1672;
const REFERENCE_CENTER_V = 470 / 941;
const REFERENCE_WORLD_SPAN_X = 80.75;
const REFERENCE_WORLD_SPAN_Z = 33.1;

export type DeathmatchArenaVisualOptions = {
  radiusX: number;
  radiusZ: number;
  rings: number;
  segments: number;
  getHeightAt(x: number, z: number): number;
};

export type DeathmatchArenaVisuals = {
  group: THREE.Group;
  update(elapsedTime: number, reducedMotion: boolean): void;
};

export function createDeathmatchArenaVisuals(options: DeathmatchArenaVisualOptions): DeathmatchArenaVisuals {
  const loader = new THREE.TextureLoader();
  const referenceTexture = loadColorTexture(loader, arenaReferenceUrl);

  const group = new THREE.Group();
  group.name = "Deathmatch Sunbaked Arena";

  const surfaceGeometry = createSurfaceGeometry(options);
  const surface = new THREE.Mesh(
    surfaceGeometry,
    new THREE.MeshBasicMaterial({
      map: referenceTexture,
      color: "#ffffff",
      toneMapped: false,
    }),
  );
  surface.name = "Deathmatch Pool Surface";
  surface.userData.arenaSurface = true;
  group.add(surface);

  const outerGround = new THREE.Mesh(
    createOuterGroundGeometry(options.radiusX, options.radiusZ, options.segments),
    new THREE.MeshBasicMaterial({
      map: referenceTexture,
      color: "#ffffff",
      toneMapped: false,
      side: THREE.DoubleSide,
    }),
  );
  outerGround.name = "Deathmatch Courtyard";
  outerGround.position.y = options.getHeightAt(options.radiusX, 0) - 0.045;
  group.add(outerGround);

  const rim = createBrickRim(options, referenceTexture);
  group.add(rim);

  return {
    group,
    update(): void {},
  };
}

function createSurfaceGeometry(options: DeathmatchArenaVisualOptions): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let ring = 0; ring <= options.rings; ring += 1) {
    const ratio = ring / options.rings;
    for (let segment = 0; segment < options.segments; segment += 1) {
      const angle = segment / options.segments * Math.PI * 2;
      const x = Math.cos(angle) * options.radiusX * ratio;
      const z = Math.sin(angle) * options.radiusZ * ratio;
      positions.push(x, options.getHeightAt(x, z), z);
      pushReferenceUv(uvs, x, z);
    }
  }

  for (let ring = 0; ring < options.rings; ring += 1) {
    const row = ring * options.segments;
    const nextRow = (ring + 1) * options.segments;
    for (let segment = 0; segment < options.segments; segment += 1) {
      const next = (segment + 1) % options.segments;
      indices.push(row + segment, row + next, nextRow + segment);
      indices.push(row + next, nextRow + next, nextRow + segment);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createOuterGroundGeometry(radiusX: number, radiusZ: number, segments: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const innerX = radiusX * 1.015;
  const innerZ = radiusZ * 1.02;
  const outerX = REFERENCE_WORLD_SPAN_X * Math.min(REFERENCE_CENTER_U, 1 - REFERENCE_CENTER_U);
  const outerZ = REFERENCE_WORLD_SPAN_Z * Math.min(REFERENCE_CENTER_V, 1 - REFERENCE_CENTER_V);

  for (let segment = 0; segment <= segments; segment += 1) {
    const angle = segment / segments * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const innerPositionX = cos * innerX;
    const innerPositionZ = sin * innerZ;
    const distanceToRectangle = Math.min(
      outerX / Math.max(Math.abs(cos), 0.0001),
      outerZ / Math.max(Math.abs(sin), 0.0001),
    );
    const outerPositionX = cos * distanceToRectangle;
    const outerPositionZ = sin * distanceToRectangle;
    positions.push(innerPositionX, 0, innerPositionZ, outerPositionX, 0, outerPositionZ);
    pushReferenceUv(uvs, innerPositionX, innerPositionZ);
    pushReferenceUv(uvs, outerPositionX, outerPositionZ);
  }

  for (let segment = 0; segment < segments; segment += 1) {
    const offset = segment * 2;
    indices.push(offset, offset + 2, offset + 1);
    indices.push(offset + 1, offset + 2, offset + 3);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createBrickRim(options: DeathmatchArenaVisualOptions, texture: THREE.Texture): THREE.Mesh {
  const geometry = createProfiledEllipticalRimGeometry(options);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    color: "#ffffff",
    toneMapped: false,
  });
  const rim = new THREE.Mesh(geometry, material);
  rim.name = "Deathmatch Brick Rim";
  return rim;
}

function createProfiledEllipticalRimGeometry(options: DeathmatchArenaVisualOptions): THREE.BufferGeometry {
  const profile = [
    { offset: -0.2, y: -0.48, v: 0 },
    { offset: -0.2, y: -0.08, v: 0.16 },
    { offset: 0.05, y: 0.18, v: 0.34 },
    { offset: 1.72, y: 0.18, v: 0.62 },
    { offset: 2.05, y: 0.02, v: 0.78 },
    { offset: 2.02, y: -0.45, v: 0.96 },
    { offset: 1.62, y: -0.55, v: 1 },
    { offset: -0.2, y: -0.48, v: 1.16 },
  ];
  const segments = 192;
  const baseHeight = options.getHeightAt(options.radiusX, 0) + 0.08;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const outward = new THREE.Vector2();

  for (let segment = 0; segment <= segments; segment += 1) {
    const ratio = segment / segments;
    const angle = ratio * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    outward.set(cos / options.radiusX, sin / options.radiusZ).normalize();
    for (const point of profile) {
      const x = cos * options.radiusX + outward.x * point.offset;
      const z = sin * options.radiusZ + outward.y * point.offset;
      positions.push(
        x,
        baseHeight + point.y,
        z,
      );
      pushReferenceUv(uvs, x, z);
    }
  }

  for (let segment = 0; segment < segments; segment += 1) {
    const row = segment * profile.length;
    const nextRow = (segment + 1) * profile.length;
    for (let point = 0; point < profile.length - 1; point += 1) {
      indices.push(row + point, nextRow + point, row + point + 1);
      indices.push(row + point + 1, nextRow + point, nextRow + point + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function pushReferenceUv(uvs: number[], x: number, z: number): void {
  uvs.push(
    REFERENCE_CENTER_U + x / REFERENCE_WORLD_SPAN_X,
    REFERENCE_CENTER_V + z / REFERENCE_WORLD_SPAN_Z,
  );
}

function loadColorTexture(loader: THREE.TextureLoader, url: string): THREE.Texture {
  const texture = loader.load(url);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 4;
  return texture;
}
