import * as THREE from "three";

export type LightningLineLayerId = "yellowCore" | "yellowGlow" | "darkArc";

export type LightningLineVfxOptions = {
  coreColor?: string;
  glowColor?: string;
  darkColor?: string;
  coreWidth?: number;
  glowWidth?: number;
  darkWidth?: number;
  sampleLength?: number;
  minSamples?: number;
  maxSamples?: number;
  noiseScale?: number;
  noiseStrength?: number;
  poolSize?: number;
  shapeStepSeconds?: number;
  strikeDuration?: number;
};

type LayerRuntime = {
  id: LightningLineLayerId;
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  opacity: number;
  shapeOffset: number;
  enabled: boolean;
};

type ShapeGeometries = Record<LightningLineLayerId, THREE.BufferGeometry>;

type RibbonBuildOptions = {
  width: number;
  positions: number[];
  indices: number[];
  layerOffset: THREE.Vector3;
};

const defaultOptions: Required<LightningLineVfxOptions> = {
  coreColor: "#fff200",
  glowColor: "#ffd94a",
  darkColor: "#120f08",
  coreWidth: 0.05,
  glowWidth: 0.1,
  darkWidth: 0.045,
  sampleLength: 0.1,
  minSamples: 2,
  maxSamples: 7,
  noiseScale: 4.4,
  noiseStrength: 1.5,
  poolSize: 24,
  shapeStepSeconds: 1 / 30,
  strikeDuration: 0.24,
};

const thicknessCurve = [
  { x: 0, y: 0 },
  { x: 0.19545456767082214, y: 0.7249997854232788 },
  { x: 0.5045454502105713, y: 0.981249988079071 },
  { x: 0.8045456409454346, y: 0.7375000715255737 },
  { x: 1, y: 0 },
];

const localLineAxis = new THREE.Vector3(1, 0, 0);

export class LightningLineVfx {
  readonly group = new THREE.Group();

  private readonly options: Required<LightningLineVfxOptions>;
  private readonly layers: LayerRuntime[];
  private readonly shapePool: ShapeGeometries[] = [];
  private readonly start = new THREE.Vector3();
  private readonly end = new THREE.Vector3(0, 0, 1);
  private readonly direction = new THREE.Vector3(1, 0, 0);
  private readonly midpoint = new THREE.Vector3();
  private readonly rotation = new THREE.Quaternion();
  private readonly scale = new THREE.Vector3(1, 1, 1);
  private currentShapeIndex = -1;
  private strikeLife = 0;
  private hasEndpoints = false;

  constructor(options: LightningLineVfxOptions = {}) {
    this.options = { ...defaultOptions, ...options };
    this.group.name = "Lightning Line VFX";
    this.layers = [
      this.createLayer("yellowGlow", this.options.glowColor, 0.28, 0, true),
      this.createLayer("yellowCore", this.options.coreColor, 0.88, 0, true),
      this.createLayer("darkArc", this.options.darkColor, 0.7, 9, true),
    ];

    this.buildShapePool();
    this.setShapeIndex(0);
    this.group.visible = false;
  }

  setEndpoints(start: THREE.Vector3, end: THREE.Vector3): void {
    this.start.copy(start);
    this.end.copy(end);
    this.hasEndpoints = true;
    this.group.visible = true;
    this.updateTransform();
  }

  strike(start: THREE.Vector3, end: THREE.Vector3): void {
    this.setEndpoints(start, end);
    this.strikeLife = this.options.strikeDuration;
  }

  setLayerEnabled(layerId: LightningLineLayerId, enabled: boolean): void {
    const layer = this.layers.find((candidate) => candidate.id === layerId);
    if (!layer) {
      return;
    }
    layer.enabled = enabled;
    layer.mesh.visible = enabled;
  }

  update(deltaTime: number, elapsedTime: number, _camera: THREE.Camera): void {
    if (!this.hasEndpoints) {
      this.group.visible = false;
      return;
    }

    this.strikeLife = Math.max(0, this.strikeLife - deltaTime);
    this.updateTransform();
    this.setShapeIndex(Math.floor(elapsedTime / this.options.shapeStepSeconds));
    this.updateLayerOpacity(elapsedTime);
  }

  dispose(): void {
    for (const shape of this.shapePool) {
      for (const geometry of Object.values(shape)) {
        geometry.dispose();
      }
    }
    for (const layer of this.layers) {
      layer.material.dispose();
    }
  }

  private createLayer(
    id: LightningLineLayerId,
    color: string,
    opacity: number,
    shapeOffset: number,
    enabled: boolean,
  ): LayerRuntime {
    const material = createLightningMaterial(color, opacity, id === "darkArc" ? THREE.MultiplyBlending : THREE.AdditiveBlending);
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
    mesh.name = id;
    mesh.renderOrder = id === "yellowGlow" ? 7 : 8;
    mesh.frustumCulled = false;
    mesh.visible = enabled;
    this.group.add(mesh);
    return { id, mesh, material, opacity, shapeOffset, enabled };
  }

  private buildShapePool(): void {
    const sampleCount = THREE.MathUtils.clamp(this.options.maxSamples, this.options.minSamples, this.options.maxSamples);

    for (let i = 0; i < this.options.poolSize; i += 1) {
      this.shapePool.push({
        yellowCore: this.createShapeGeometry(i, sampleCount, this.options.coreWidth, new THREE.Vector3(0, 0, 0)),
        yellowGlow: this.createShapeGeometry(i + 0.5, sampleCount, this.options.glowWidth, new THREE.Vector3(0, 0, 0)),
        darkArc: this.createShapeGeometry(i + 9, sampleCount, this.options.darkWidth, new THREE.Vector3(0, 0.045, -0.035)),
      });
    }
  }

  private createShapeGeometry(
    shapeIndex: number,
    sampleCount: number,
    width: number,
    layerOffset: THREE.Vector3,
  ): THREE.BufferGeometry {
    const points: THREE.Vector3[] = [];
    const w = shapeIndex * 0.73;

    for (let i = 0; i <= sampleCount; i += 1) {
      const t = i / sampleCount;
      const point = new THREE.Vector3(t, 0, 0);
      const offset = sampleNoiseColorOffset(point, this.options.noiseScale, w);
      const pin = Math.sin(t * Math.PI);
      point.y += offset.y * this.options.noiseStrength * pin;
      point.z += offset.z * this.options.noiseStrength * pin;
      points.push(point);
    }

    const positions: number[] = [];
    const indices: number[] = [];
    appendRibbon(points, { width, positions, indices, layerOffset });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    return geometry;
  }

  private setShapeIndex(index: number): void {
    const shapeIndex = wrapIndex(index, this.shapePool.length);
    if (shapeIndex === this.currentShapeIndex) {
      return;
    }
    this.currentShapeIndex = shapeIndex;
    for (const layer of this.layers) {
      const layerShapeIndex = wrapIndex(shapeIndex + layer.shapeOffset, this.shapePool.length);
      layer.mesh.geometry = this.shapePool[layerShapeIndex][layer.id];
    }
  }

  private updateTransform(): void {
    const distance = this.start.distanceTo(this.end);
    if (distance < 0.001) {
      this.group.visible = false;
      return;
    }

    this.group.visible = true;
    this.midpoint.copy(this.start);
    this.direction.subVectors(this.end, this.start).normalize();
    this.rotation.setFromUnitVectors(localLineAxis, this.direction);
    this.scale.set(distance, 1, 1);

    this.group.position.copy(this.midpoint);
    this.group.quaternion.copy(this.rotation);
    this.group.scale.copy(this.scale);
  }

  private updateLayerOpacity(elapsedTime: number): void {
    const strikeBoost = this.strikeLife > 0 ? 0.28 + this.strikeLife / this.options.strikeDuration : 0;
    const flicker = 0.82 + Math.sin(elapsedTime * 74.0) * 0.1 + hash1(elapsedTime * 24.0) * 0.08;
    const intensity = THREE.MathUtils.clamp(flicker + strikeBoost, 0.35, 1.25);

    for (const layer of this.layers) {
      layer.material.opacity = layer.opacity * intensity;
      layer.mesh.visible = layer.enabled;
    }
  }
}

function createLightningMaterial(color: string, opacity: number, blending: THREE.Blending): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending,
  });
}

function appendRibbon(points: THREE.Vector3[], options: RibbonBuildOptions): void {
  for (let i = 0; i < points.length; i += 1) {
    const t = points.length <= 1 ? 0 : i / (points.length - 1);
    const halfWidth = options.width * sampleThickness(t) * 0.5;
    const point = points[i].clone().add(options.layerOffset);
    options.positions.push(point.x, point.y + halfWidth, point.z, point.x, point.y - halfWidth, point.z);

    if (i < points.length - 1) {
      const start = i * 2;
      options.indices.push(start, start + 2, start + 1, start + 1, start + 2, start + 3);
    }
  }
}

function sampleThickness(t: number): number {
  for (let i = 1; i < thicknessCurve.length; i += 1) {
    const previous = thicknessCurve[i - 1];
    const next = thicknessCurve[i];
    if (t <= next.x) {
      const span = next.x - previous.x;
      const localT = span > 0 ? (t - previous.x) / span : 0;
      return THREE.MathUtils.lerp(previous.y, next.y, smoothStep01(localT));
    }
  }
  return 0;
}

function sampleNoiseColorOffset(point: THREE.Vector3, scale: number, w: number): THREE.Vector3 {
  return new THREE.Vector3(
    valueNoise4(point.x * scale + 13.1, point.y * scale, point.z * scale, w) - 0.5,
    valueNoise4(point.x * scale, point.y * scale + 37.7, point.z * scale, w + 11.3) - 0.5,
    valueNoise4(point.x * scale, point.y * scale, point.z * scale + 71.9, w + 23.5) - 0.5,
  );
}

function valueNoise4(x: number, y: number, z: number, w: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const iw = Math.floor(w);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const fw = w - iw;
  const ux = smoothStep01(fx);
  const uy = smoothStep01(fy);
  const uz = smoothStep01(fz);
  const uw = smoothStep01(fw);

  let value = 0;
  for (let dx = 0; dx <= 1; dx += 1) {
    const wx = dx === 0 ? 1 - ux : ux;
    for (let dy = 0; dy <= 1; dy += 1) {
      const wy = dy === 0 ? 1 - uy : uy;
      for (let dz = 0; dz <= 1; dz += 1) {
        const wz = dz === 0 ? 1 - uz : uz;
        for (let dw = 0; dw <= 1; dw += 1) {
          const ww = dw === 0 ? 1 - uw : uw;
          value += hash4(ix + dx, iy + dy, iz + dz, iw + dw) * wx * wy * wz * ww;
        }
      }
    }
  }

  return value;
}

function wrapIndex(index: number, length: number): number {
  return ((index % length) + length) % length;
}

function hash1(value: number): number {
  return fract(Math.sin(Math.floor(value) * 127.1) * 43758.5453);
}

function hash4(x: number, y: number, z: number, w: number): number {
  return fract(Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + w * 269.5) * 43758.5453);
}

function fract(value: number): number {
  return value - Math.floor(value);
}

function smoothStep01(value: number): number {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}
