import * as THREE from "three";

const beamTextureUrl = `${import.meta.env.BASE_URL}assets/vfx/beam/T_VFX_lightning.webp`;
const effectDuration = 0.5;
const reducedMotionDuration = 0.22;
const growDuration = 0.14;
const shapeStepSeconds = 1 / 30;
const shapeCount = 24;
const minArcCount = 3;
const maxArcCount = 5;
const pointsPerArc = 10;
const maxRadius = 2;

export type BeamHitVfxColors = {
  dark: string;
  glow: string;
  core: string;
  electric: string;
  hot: string;
};

export type BeamHitVfxOptions = {
  colors?: Partial<BeamHitVfxColors>;
};

type ArcShape = {
  arcs: THREE.Vector3[][];
};

type BeamLayer = {
  material: THREE.ShaderMaterial;
  baseOpacity: number;
};

type BeamMaterialOptions = {
  color: string;
  opacity: number;
  scrollSpeed: number;
  threshold: number;
  warpStrength: number;
  width: number;
  blending: THREE.Blending;
};

const defaultColors: BeamHitVfxColors = {
  dark: "#0c0603",
  glow: "#ff9d00",
  core: "#ffd51f",
  electric: "#fff238",
  hot: "#ffffff",
};

export class BeamHitVfx {
  readonly group = new THREE.Group();

  private readonly texture: THREE.Texture;
  private readonly maskTexture: THREE.DataTexture;
  private readonly ribbonGeometry: THREE.BufferGeometry;
  private readonly positionAttribute: THREE.BufferAttribute;
  private readonly sideAttribute: THREE.BufferAttribute;
  private readonly layers: BeamLayer[];
  private readonly flashGeometry = new THREE.PlaneGeometry(1, 1);
  private readonly flashMaterial: THREE.ShaderMaterial;
  private readonly flashMesh: THREE.Mesh;
  private readonly shapes: ArcShape[];
  private readonly colors: BeamHitVfxColors;
  private readonly cameraPosition = new THREE.Vector3();
  private readonly pointWorld = new THREE.Vector3();
  private readonly tangent = new THREE.Vector3();
  private readonly viewDirection = new THREE.Vector3();
  private readonly ribbonSide = new THREE.Vector3();
  private active = false;
  private reducedMotion = false;
  private age = 0;
  private startShapeIndex = 0;

  constructor(options: BeamHitVfxOptions = {}) {
    this.colors = { ...defaultColors, ...options.colors };
    this.group.name = "Beam Hit VFX";
    this.group.visible = false;

    this.texture = loadBeamTexture();
    this.maskTexture = createBeamMaskTexture();
    const ribbon = createRibbonGeometry();
    this.ribbonGeometry = ribbon.geometry;
    this.positionAttribute = ribbon.positionAttribute;
    this.sideAttribute = ribbon.sideAttribute;

    this.layers = [
      this.createLayer("Beam Hit Dark Backing", {
        color: this.colors.dark,
        opacity: 0.82,
        scrollSpeed: 1.96,
        threshold: 0.55,
        warpStrength: 0.04,
        width: 0.34,
        blending: THREE.NormalBlending,
      }, 5),
      this.createLayer("Beam Hit Glow", {
        color: this.colors.glow,
        opacity: 0.38,
        scrollSpeed: 0.92,
        threshold: 0.025,
        warpStrength: 0.08,
        width: 0.42,
        blending: THREE.AdditiveBlending,
      }, 6),
      this.createLayer("Beam Hit Core", {
        color: this.colors.core,
        opacity: 0.94,
        scrollSpeed: 0.82,
        threshold: 0.16,
        warpStrength: 0.06,
        width: 0.24,
        blending: THREE.AdditiveBlending,
      }, 7),
      this.createLayer("Beam Hit Electric Filaments", {
        color: this.colors.electric,
        opacity: 1,
        scrollSpeed: 2.4,
        threshold: 0.62,
        warpStrength: 0.32,
        width: 0.16,
        blending: THREE.AdditiveBlending,
      }, 8),
    ];

    this.flashMaterial = createFlashMaterial(this.colors.glow, this.colors.hot);
    this.flashMesh = new THREE.Mesh(this.flashGeometry, this.flashMaterial);
    this.flashMesh.name = "Beam Hit Center Flash";
    this.flashMesh.frustumCulled = false;
    this.flashMesh.renderOrder = 9;
    this.group.add(this.flashMesh);

    this.shapes = buildShapePool();
    this.applyColors();
  }

  spawn(position: THREE.Vector3, reducedMotion = false): void {
    this.group.position.copy(position);
    this.group.visible = true;
    this.flashMesh.visible = true;
    this.reducedMotion = reducedMotion;
    this.age = 0;
    this.startShapeIndex = Math.floor(Math.random() * this.shapes.length);
    this.active = true;
  }

  update(deltaTime: number, elapsedTime: number, camera: THREE.Camera): void {
    if (!this.active) {
      return;
    }

    this.age += deltaTime;
    const duration = this.reducedMotion ? reducedMotionDuration : effectDuration;
    if (this.age >= duration) {
      this.active = false;
      this.group.visible = false;
      this.flashMesh.visible = false;
      return;
    }

    const shapeOffset = this.reducedMotion ? 0 : Math.floor(this.age / shapeStepSeconds);
    const shape = this.shapes[(this.startShapeIndex + shapeOffset) % this.shapes.length];
    this.updateRibbonGeometry(shape, camera);

    const growthLimit = this.reducedMotion ? 0.58 : 1;
    const growthTime = this.reducedMotion ? 0.07 : growDuration;
    const growth = easeOutCubic(THREE.MathUtils.clamp(this.age / growthTime, 0, 1)) * growthLimit;
    const fadeStart = this.reducedMotion ? 0.09 : 0.3;
    const fade = 1 - smoothstep(fadeStart, duration, this.age);
    const flashIn = easeOutCubic(THREE.MathUtils.clamp(this.age / 0.035, 0, 1));
    const strength = flashIn * fade;

    for (const layer of this.layers) {
      layer.material.uniforms.uTime.value = elapsedTime;
      layer.material.uniforms.uGrowth.value = growth;
      layer.material.uniforms.uOpacity.value = layer.baseOpacity * strength;
    }

    this.updateFlash(camera, duration);
  }

  setColors(colors: Partial<BeamHitVfxColors>): void {
    Object.assign(this.colors, colors);
    this.applyColors();
  }

  dispose(): void {
    this.ribbonGeometry.dispose();
    this.texture.dispose();
    this.maskTexture.dispose();
    for (const layer of this.layers) {
      layer.material.dispose();
    }
    this.flashGeometry.dispose();
    this.flashMaterial.dispose();
  }

  private createLayer(name: string, options: BeamMaterialOptions, renderOrder: number): BeamLayer {
    const material = createBeamMaterial(this.texture, this.maskTexture, options, this.colors.hot);
    const mesh = new THREE.Mesh(this.ribbonGeometry, material);
    mesh.name = name;
    mesh.frustumCulled = false;
    mesh.renderOrder = renderOrder;
    this.group.add(mesh);
    return { material, baseOpacity: options.opacity };
  }

  private applyColors(): void {
    const hot = new THREE.Color(this.colors.hot);
    const layerColors = [this.colors.dark, this.colors.glow, this.colors.core, this.colors.electric];
    const hotMix = [0.08, 0.55, 0.78, 1];

    for (let index = 0; index < this.layers.length; index += 1) {
      const base = new THREE.Color(layerColors[index]);
      this.layers[index].material.uniforms.uColor.value.copy(base);
      this.layers[index].material.uniforms.uHotColor.value.copy(base).lerp(hot, hotMix[index]);
    }

    this.flashMaterial.uniforms.uColor.value.set(this.colors.glow);
    this.flashMaterial.uniforms.uHotColor.value.set(this.colors.hot);
  }

  private updateRibbonGeometry(shape: ArcShape, camera: THREE.Camera): void {
    camera.getWorldPosition(this.cameraPosition);
    const positions = this.positionAttribute.array as Float32Array;
    const sides = this.sideAttribute.array as Float32Array;

    for (let arcIndex = 0; arcIndex < maxArcCount; arcIndex += 1) {
      const points = shape.arcs[arcIndex];
      for (let pointIndex = 0; pointIndex < pointsPerArc; pointIndex += 1) {
        const point = points?.[pointIndex];
        const vertexOffset = (arcIndex * pointsPerArc + pointIndex) * 6;

        if (!point) {
          positions.fill(0, vertexOffset, vertexOffset + 6);
          sides.fill(0, vertexOffset, vertexOffset + 6);
          continue;
        }

        const previous = points[Math.max(0, pointIndex - 1)];
        const next = points[Math.min(points.length - 1, pointIndex + 1)];
        this.tangent.subVectors(next, previous).normalize();
        this.pointWorld.copy(point).add(this.group.position);
        this.viewDirection.subVectors(this.cameraPosition, this.pointWorld).normalize();
        this.ribbonSide.crossVectors(this.tangent, this.viewDirection);
        if (this.ribbonSide.lengthSq() < 0.0001) {
          const fallbackAxis = Math.abs(this.tangent.y) < 0.9 ? THREE.Object3D.DEFAULT_UP : xAxis;
          this.ribbonSide.crossVectors(this.tangent, fallbackAxis);
        }
        this.ribbonSide.normalize();

        positions[vertexOffset] = point.x;
        positions[vertexOffset + 1] = point.y;
        positions[vertexOffset + 2] = point.z;
        positions[vertexOffset + 3] = point.x;
        positions[vertexOffset + 4] = point.y;
        positions[vertexOffset + 5] = point.z;
        sides[vertexOffset] = this.ribbonSide.x;
        sides[vertexOffset + 1] = this.ribbonSide.y;
        sides[vertexOffset + 2] = this.ribbonSide.z;
        sides[vertexOffset + 3] = -this.ribbonSide.x;
        sides[vertexOffset + 4] = -this.ribbonSide.y;
        sides[vertexOffset + 5] = -this.ribbonSide.z;
      }
    }

    this.positionAttribute.needsUpdate = true;
    this.sideAttribute.needsUpdate = true;
  }

  private updateFlash(camera: THREE.Camera, duration: number): void {
    const flashEnd = this.reducedMotion ? duration : 0.32;
    if (this.age >= flashEnd) {
      this.flashMesh.visible = false;
      return;
    }

    const flashIn = easeOutCubic(THREE.MathUtils.clamp(this.age / 0.035, 0, 1));
    const flashOut = 1 - smoothstep(0.075, flashEnd, this.age);
    const scaleProgress = easeOutCubic(THREE.MathUtils.clamp(this.age / 0.14, 0, 1));
    const maxScale = this.reducedMotion ? 0.62 : 0.95;
    this.flashMesh.visible = true;
    this.flashMesh.quaternion.copy(camera.quaternion);
    this.flashMesh.scale.setScalar(THREE.MathUtils.lerp(0.24, maxScale, scaleProgress));
    this.flashMaterial.uniforms.uOpacity.value = flashIn * flashOut;
  }
}

const xAxis = new THREE.Vector3(1, 0, 0);

function createRibbonGeometry(): {
  geometry: THREE.BufferGeometry;
  positionAttribute: THREE.BufferAttribute;
  sideAttribute: THREE.BufferAttribute;
} {
  const vertexCount = maxArcCount * pointsPerArc * 2;
  const positions = new Float32Array(vertexCount * 3);
  const sides = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const indices: number[] = [];

  for (let arcIndex = 0; arcIndex < maxArcCount; arcIndex += 1) {
    const vertexBase = arcIndex * pointsPerArc * 2;
    for (let pointIndex = 0; pointIndex < pointsPerArc; pointIndex += 1) {
      const t = pointIndex / (pointsPerArc - 1);
      const uvOffset = (vertexBase + pointIndex * 2) * 2;
      uvs[uvOffset] = t;
      uvs[uvOffset + 1] = 0;
      uvs[uvOffset + 2] = t;
      uvs[uvOffset + 3] = 1;

      if (pointIndex < pointsPerArc - 1) {
        const start = vertexBase + pointIndex * 2;
        indices.push(start, start + 2, start + 1, start + 1, start + 2, start + 3);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  const positionAttribute = new THREE.BufferAttribute(positions, 3);
  const sideAttribute = new THREE.BufferAttribute(sides, 3);
  positionAttribute.setUsage(THREE.DynamicDrawUsage);
  sideAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position", positionAttribute);
  geometry.setAttribute("aSide", sideAttribute);
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), maxRadius + 0.5);
  return { geometry, positionAttribute, sideAttribute };
}

function buildShapePool(): ArcShape[] {
  const shapes: ArcShape[] = [];
  for (let shapeIndex = 0; shapeIndex < shapeCount; shapeIndex += 1) {
    const random = createSeededRandom(0x9e3779b9 ^ (shapeIndex * 0x85ebca6b));
    const arcCount = minArcCount + Math.floor(random() * (maxArcCount - minArcCount + 1));
    const rotation = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(random() * Math.PI, random() * Math.PI * 2, random() * Math.PI),
    );
    const arcs: THREE.Vector3[][] = [];

    for (let arcIndex = 0; arcIndex < arcCount; arcIndex += 1) {
      const y = 1 - 2 * ((arcIndex + 0.5) / arcCount);
      const radial = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = arcIndex * Math.PI * (3 - Math.sqrt(5)) + random() * 0.85;
      const direction = new THREE.Vector3(Math.cos(theta) * radial, y, Math.sin(theta) * radial)
        .applyQuaternion(rotation)
        .normalize();
      const basisA = new THREE.Vector3().crossVectors(direction, Math.abs(direction.y) < 0.9 ? THREE.Object3D.DEFAULT_UP : xAxis).normalize();
      const basisB = new THREE.Vector3().crossVectors(direction, basisA).normalize();
      const length = maxRadius * THREE.MathUtils.lerp(0.68, 1, random());
      const seedA = random() * 100;
      const seedB = random() * 100 + 200;
      const macroBendA = (random() - 0.5) * 0.65;
      const macroBendB = (random() - 0.5) * 0.65;
      const points: THREE.Vector3[] = [];

      for (let pointIndex = 0; pointIndex < pointsPerArc; pointIndex += 1) {
        const t = pointIndex / (pointsPerArc - 1);
        const taper = Math.sin(t * Math.PI);
        const noiseAmplitude = length * (0.08 + t * 0.18) * taper;
        const noiseA = signedValueNoise(t * 7.5, seedA) * 0.74 + signedValueNoise(t * 16, seedA + 17) * 0.26;
        const noiseB = signedValueNoise(t * 6.5, seedB) * 0.74 + signedValueNoise(t * 14, seedB + 29) * 0.26;
        const point = direction.clone().multiplyScalar(length * t);
        point.addScaledVector(basisA, (noiseA + macroBendA * Math.sin(t * Math.PI)) * noiseAmplitude);
        point.addScaledVector(basisB, (noiseB + macroBendB * Math.sin(t * Math.PI)) * noiseAmplitude);
        points.push(point);
      }
      arcs.push(points);
    }
    shapes.push({ arcs });
  }
  return shapes;
}

function loadBeamTexture(): THREE.Texture {
  const texture = new THREE.TextureLoader().load(beamTextureUrl);
  texture.name = "Beam Hit Lightning Texture";
  texture.wrapS = THREE.MirroredRepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

function createBeamMaskTexture(): THREE.DataTexture {
  const width = 256;
  const data = new Uint8Array(width * 4);
  for (let index = 0; index < width; index += 1) {
    const t = index / (width - 1);
    const fadeIn = smoothstep(0, 0.055, t);
    const fadeOut = 1 - smoothstep(0.84, 1, t);
    const value = Math.round(255 * fadeIn * fadeOut);
    const offset = index * 4;
    data[offset] = value;
    data[offset + 1] = value;
    data[offset + 2] = value;
    data[offset + 3] = 255;
  }

  const texture = new THREE.DataTexture(data, width, 1, THREE.RGBAFormat);
  texture.name = "Beam Hit End Mask";
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

function createBeamMaterial(
  texture: THREE.Texture,
  maskTexture: THREE.Texture,
  options: BeamMaterialOptions,
  hotColor: string,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: texture },
      uMaskTexture: { value: maskTexture },
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uScrollSpeed: { value: options.scrollSpeed },
      uThreshold: { value: options.threshold },
      uWarpStrength: { value: options.warpStrength },
      uWidth: { value: options.width },
      uGrowth: { value: 0 },
      uColor: { value: new THREE.Color(options.color) },
      uHotColor: { value: new THREE.Color(hotColor) },
    },
    vertexShader: beamVertexShader,
    fragmentShader: beamFragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: options.blending,
    toneMapped: false,
  });
}

function createFlashMaterial(color: string, hotColor: string): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uHotColor: { value: new THREE.Color(hotColor) },
    },
    vertexShader: flashVertexShader,
    fragmentShader: flashFragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function signedValueNoise(value: number, seed: number): number {
  const cell = Math.floor(value);
  const local = smoothStep01(value - cell);
  return THREE.MathUtils.lerp(hash1(cell + seed), hash1(cell + 1 + seed), local) * 2 - 1;
}

function hash1(value: number): number {
  return fract(Math.sin(value * 127.1) * 43758.5453);
}

function fract(value: number): number {
  return value - Math.floor(value);
}

function smoothStep01(value: number): number {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  return smoothStep01((value - edge0) / (edge1 - edge0));
}

function easeOutCubic(value: number): number {
  return 1 - Math.pow(1 - value, 3);
}

const beamVertexShader = `
  attribute vec3 aSide;
  uniform float uWidth;
  uniform float uGrowth;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    float taperIn = smoothstep(0.0, 0.11, uv.x);
    float taperOut = 1.0 - smoothstep(0.72, 1.0, uv.x);
    float thickness = taperIn * taperOut;
    float widthGrowth = mix(0.3, 1.0, uGrowth);
    vec3 transformed = position * uGrowth + aSide * uWidth * thickness * widthGrowth;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
  }
`;

const beamFragmentShader = `
  uniform sampler2D uTexture;
  uniform sampler2D uMaskTexture;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uScrollSpeed;
  uniform float uThreshold;
  uniform float uWarpStrength;
  uniform vec3 uColor;
  uniform vec3 uHotColor;
  varying vec2 vUv;

  float hash21(vec2 point) {
    point = fract(point * vec2(123.34, 456.21));
    point += dot(point, point + 45.32);
    return fract(point.x * point.y);
  }

  float valueNoise(vec2 point) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    local = local * local * (3.0 - 2.0 * local);
    float a = hash21(cell);
    float b = hash21(cell + vec2(1.0, 0.0));
    float c = hash21(cell + vec2(0.0, 1.0));
    float d = hash21(cell + vec2(1.0, 1.0));
    return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
  }

  void main() {
    float travel = vUv.x * 1.35 - uTime * uScrollSpeed;
    float mirrored = abs(mod(travel, 2.0) - 1.0);
    vec2 textureUv = vec2(mirrored, vUv.y);
    float warpA = valueNoise(vec2(vUv.x * 30.0 - uTime * 3.7, vUv.y * 8.0 + uTime * 1.9));
    float warpB = valueNoise(vec2(vUv.x * 17.0 + uTime * 2.2, vUv.y * 15.0 - uTime * 2.8));
    textureUv.y += ((warpA - 0.5) * 0.72 + (warpB - 0.5) * 0.28) * uWarpStrength;
    textureUv.y = clamp(textureUv.y, 0.0, 1.0);

    vec3 textureColor = texture2D(uTexture, textureUv).rgb;
    float luminance = max(textureColor.r, max(textureColor.g, textureColor.b));
    float endMask = texture2D(uMaskTexture, vec2(vUv.x, 0.5)).r;
    float alpha = smoothstep(uThreshold, min(1.0, uThreshold + 0.24), luminance) * endMask * uOpacity;
    float heat = smoothstep(0.42, 0.92, luminance);
    vec3 color = mix(uColor, uHotColor, heat);
    if (alpha <= 0.002) {
      discard;
    }
    gl_FragColor = vec4(color, alpha);
  }
`;

const flashVertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const flashFragmentShader = `
  uniform float uOpacity;
  uniform vec3 uColor;
  uniform vec3 uHotColor;
  varying vec2 vUv;

  void main() {
    float distanceToCenter = length(vUv - 0.5) * 2.0;
    float core = 1.0 - smoothstep(0.0, 0.3, distanceToCenter);
    float glow = 1.0 - smoothstep(0.04, 1.0, distanceToCenter);
    float alpha = (core + glow * 0.78) * uOpacity;
    vec3 color = mix(uColor, uHotColor, core);
    if (alpha <= 0.002) {
      discard;
    }
    gl_FragColor = vec4(color, alpha);
  }
`;
