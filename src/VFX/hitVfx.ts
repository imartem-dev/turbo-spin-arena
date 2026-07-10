import * as THREE from "three";

export type HitVfxConfig = {
  poolSize: number;
  sparksPerHit: number;
  duration: number;
  maxRadius: number;
  intensity: number;
  atlasCellSize: number;
  centerTextureUrls: readonly string[];
  ringTextureUrls: readonly string[];
  longTextureUrls: readonly string[];
  shortTextureUrls: readonly string[];
  dissolveTextureUrl: string;
  colorGradientTextureUrl: string;
};

export type HitVfxSpawnOptions = {
  edgeColor?: THREE.ColorRepresentation;
  ringColor?: THREE.ColorRepresentation;
  reducedMotion?: boolean;
  seed?: number;
};

type CommonUniforms = {
  uTime: { value: number };
  uDuration: { value: number };
  uMaxRadius: { value: number };
  uIntensity: { value: number };
  uDissolveMask: { value: THREE.Texture };
  uColorGradient: { value: THREE.Texture };
};

type AtlasUniforms = {
  uAtlas: { value: THREE.Texture };
  uAtlasGrid: { value: number };
  uTextureCount: { value: number };
};

type LayerAttributes = {
  startTimes: THREE.InstancedBufferAttribute;
  textureIndices: THREE.InstancedBufferAttribute;
  directions: THREE.InstancedBufferAttribute;
  seeds: THREE.InstancedBufferAttribute;
  reducedMotion: THREE.InstancedBufferAttribute;
  colors: THREE.InstancedBufferAttribute;
};

type SegmentAttributes = LayerAttributes & {
  angleOffsets: THREE.InstancedBufferAttribute;
  sizeScales: THREE.InstancedBufferAttribute;
};

type SparkAttributes = {
  startTimes: THREE.InstancedBufferAttribute;
  velocities: THREE.InstancedBufferAttribute;
  sizes: THREE.InstancedBufferAttribute;
  seeds: THREE.InstancedBufferAttribute;
  colors: THREE.InstancedBufferAttribute;
};

const inactiveStartTime = -10_000;
const degreesToRadians = Math.PI / 180;
const scratchMatrix = new THREE.Matrix4();
const hitTextureBase = `${import.meta.env.BASE_URL}assets/vfx/Hit/`;

const centerTextureUrls = Array.from(
  { length: 5 },
  (_, index) => `${hitTextureBase}center_${index + 1}.webp`,
);
const ringTextureUrls = Array.from(
  { length: 6 },
  (_, index) => `${hitTextureBase}ring_${index + 1}.webp`,
);
const longTextureUrls = Array.from(
  { length: 9 },
  (_, index) => `${hitTextureBase}long_${index + 1}.webp`,
);
const shortTextureUrls = Array.from(
  { length: 6 },
  (_, index) => `${hitTextureBase}short_${index + 1}.webp`,
);

export const defaultHitVfxConfig: HitVfxConfig = {
  poolSize: 16,
  sparksPerHit: 16,
  duration: 0.42,
  maxRadius: 1.08,
  intensity: 1.25,
  atlasCellSize: 512,
  centerTextureUrls,
  ringTextureUrls,
  longTextureUrls,
  shortTextureUrls,
  dissolveTextureUrl: `${hitTextureBase}T_VFX_Flare_616.webp`,
  colorGradientTextureUrl: `${hitTextureBase}T_VFX_Glo31.webp`,
};

export class HitVfxPool {
  readonly group = new THREE.Group();
  readonly ready: Promise<void>;

  private readonly config: HitVfxConfig;
  private readonly commonUniforms: CommonUniforms;
  private readonly centerAtlasUniforms: AtlasUniforms;
  private readonly ringAtlasUniforms: AtlasUniforms;
  private readonly segmentAtlasUniforms: AtlasUniforms;
  private readonly fallbackTexture: THREE.DataTexture;

  private readonly centerGeometry: THREE.PlaneGeometry;
  private readonly centerMaterial: THREE.ShaderMaterial;
  private readonly centerMesh: THREE.InstancedMesh;
  private readonly centerAttributes: LayerAttributes;

  private readonly ringGeometry: THREE.PlaneGeometry;
  private readonly ringMaterial: THREE.ShaderMaterial;
  private readonly ringMesh: THREE.InstancedMesh;
  private readonly ringAttributes: LayerAttributes;

  private readonly segmentGeometry: THREE.PlaneGeometry;
  private readonly segmentMaterial: THREE.ShaderMaterial;
  private readonly segmentMesh: THREE.InstancedMesh;
  private readonly segmentAttributes: SegmentAttributes;

  private readonly sparkGeometry: THREE.PlaneGeometry;
  private readonly sparkMaterial: THREE.ShaderMaterial;
  private readonly sparkMesh: THREE.InstancedMesh;
  private readonly sparkAttributes: SparkAttributes;

  private centerAtlas: THREE.Texture;
  private ringAtlas: THREE.Texture;
  private segmentAtlas: THREE.Texture;
  private dissolveTexture: THREE.Texture;
  private gradientTexture: THREE.Texture;
  private time = 0;
  private nextSlot = 0;
  private disposed = false;

  constructor(config: Partial<HitVfxConfig> = {}) {
    this.config = normalizeConfig(config);
    this.group.name = "VFX_Directional Hit Pool";

    this.fallbackTexture = createFallbackTexture();
    this.centerAtlas = this.fallbackTexture;
    this.ringAtlas = this.fallbackTexture;
    this.segmentAtlas = this.fallbackTexture;
    this.dissolveTexture = this.fallbackTexture;
    this.gradientTexture = this.fallbackTexture;

    this.commonUniforms = {
      uTime: { value: 0 },
      uDuration: { value: this.config.duration },
      uMaxRadius: { value: this.config.maxRadius },
      uIntensity: { value: this.config.intensity },
      uDissolveMask: { value: this.dissolveTexture },
      uColorGradient: { value: this.gradientTexture },
    };
    this.centerAtlasUniforms = createAtlasUniforms(this.fallbackTexture);
    this.ringAtlasUniforms = createAtlasUniforms(this.fallbackTexture);
    this.segmentAtlasUniforms = createAtlasUniforms(this.fallbackTexture);

    const centerLayer = createLayerGeometry(this.config.poolSize, false);
    this.centerGeometry = centerLayer.geometry;
    this.centerAttributes = centerLayer.attributes;
    this.centerMaterial = createCenterMaterial(this.commonUniforms, this.centerAtlasUniforms);
    this.centerMesh = new THREE.InstancedMesh(
      this.centerGeometry,
      this.centerMaterial,
      this.config.poolSize,
    );
    this.centerMesh.name = "VFX_Hit Centers";
    this.centerMesh.renderOrder = 8;
    this.centerMesh.frustumCulled = false;
    initializeInstanceMatrices(this.centerMesh, this.config.poolSize);

    const ringLayer = createLayerGeometry(this.config.poolSize, false);
    this.ringGeometry = ringLayer.geometry;
    this.ringAttributes = ringLayer.attributes;
    this.ringMaterial = createRingMaterial(this.commonUniforms, this.ringAtlasUniforms);
    this.ringMesh = new THREE.InstancedMesh(
      this.ringGeometry,
      this.ringMaterial,
      this.config.poolSize,
    );
    this.ringMesh.name = "VFX_Hit Rings";
    this.ringMesh.renderOrder = 7;
    this.ringMesh.frustumCulled = false;
    initializeInstanceMatrices(this.ringMesh, this.config.poolSize);

    const segmentLayer = createSegmentGeometry(this.config.poolSize * 3);
    this.segmentGeometry = segmentLayer.geometry;
    this.segmentAttributes = segmentLayer.attributes;
    this.segmentMaterial = createSegmentMaterial(this.commonUniforms, this.segmentAtlasUniforms);
    this.segmentMesh = new THREE.InstancedMesh(
      this.segmentGeometry,
      this.segmentMaterial,
      this.config.poolSize * 3,
    );
    this.segmentMesh.name = "VFX_Hit Directional Segments";
    this.segmentMesh.renderOrder = 6;
    this.segmentMesh.frustumCulled = false;
    initializeInstanceMatrices(this.segmentMesh, this.config.poolSize * 3);

    const sparkLayer = createSparkGeometry(this.config.poolSize * this.config.sparksPerHit);
    this.sparkGeometry = sparkLayer.geometry;
    this.sparkAttributes = sparkLayer.attributes;
    this.sparkMaterial = createSparkMaterial(this.commonUniforms);
    this.sparkMesh = new THREE.InstancedMesh(
      this.sparkGeometry,
      this.sparkMaterial,
      this.config.poolSize * this.config.sparksPerHit,
    );
    this.sparkMesh.name = "VFX_Hit Radial Sparks";
    this.sparkMesh.renderOrder = 9;
    this.sparkMesh.frustumCulled = false;
    initializeInstanceMatrices(this.sparkMesh, this.config.poolSize * this.config.sparksPerHit);

    this.group.add(this.segmentMesh, this.ringMesh, this.centerMesh, this.sparkMesh);
    this.ready = this.loadTextures();
  }

  spawn(
    position: THREE.Vector3,
    direction: THREE.Vector3,
    options: HitVfxSpawnOptions = {},
  ): void {
    if (this.disposed) {
      return;
    }

    const slot = this.nextSlot;
    this.nextSlot = (this.nextSlot + 1) % this.config.poolSize;
    const startTime = this.time;
    const seed = Number.isFinite(options.seed) ? Number(options.seed) : Math.random() * 0xffff_ffff;
    const random = createSeededRandom(seed);
    const reducedMotion = options.reducedMotion ? 1 : 0;
    const edgeColor = new THREE.Color(options.edgeColor ?? "#ff8a1f");
    const ringColor = new THREE.Color(options.ringColor ?? "#ffffff");

    let directionX = direction.x;
    let directionZ = direction.z;
    const directionLength = Math.hypot(directionX, directionZ);
    if (directionLength > 0.0001) {
      directionX /= directionLength;
      directionZ /= directionLength;
    } else {
      directionX = 1;
      directionZ = 0;
    }

    scratchMatrix.makeTranslation(position.x, position.y, position.z);
    this.writeLayerInstance(
      this.centerMesh,
      this.centerAttributes,
      slot,
      startTime,
      Math.floor(random() * this.config.centerTextureUrls.length),
      directionX,
      directionZ,
      seed + 11,
      reducedMotion,
      edgeColor,
    );
    this.writeLayerInstance(
      this.ringMesh,
      this.ringAttributes,
      slot,
      startTime,
      Math.floor(random() * this.config.ringTextureUrls.length),
      directionX,
      directionZ,
      seed + 23,
      reducedMotion,
      ringColor,
    );

    const firstLongIndex = Math.floor(random() * this.config.longTextureUrls.length);
    let secondLongIndex = Math.floor(random() * (this.config.longTextureUrls.length - 1));
    if (secondLongIndex >= firstLongIndex) {
      secondLongIndex += 1;
    }
    const segmentOffset = slot * 3;
    this.writeSegmentInstance(
      segmentOffset,
      startTime,
      firstLongIndex,
      directionX,
      directionZ,
      -THREE.MathUtils.lerp(12, 25, random()) * degreesToRadians,
      THREE.MathUtils.lerp(0.92, 1.08, random()),
      seed + 37,
      reducedMotion,
      edgeColor,
    );
    this.writeSegmentInstance(
      segmentOffset + 1,
      startTime,
      secondLongIndex,
      directionX,
      directionZ,
      THREE.MathUtils.lerp(12, 25, random()) * degreesToRadians,
      THREE.MathUtils.lerp(0.92, 1.08, random()),
      seed + 53,
      reducedMotion,
      edgeColor,
    );
    this.writeSegmentInstance(
      segmentOffset + 2,
      startTime,
      this.config.longTextureUrls.length
        + Math.floor(random() * this.config.shortTextureUrls.length),
      directionX,
      directionZ,
      Math.PI + THREE.MathUtils.lerp(-15, 15, random()) * degreesToRadians,
      THREE.MathUtils.lerp(0.62, 0.78, random()),
      seed + 71,
      reducedMotion,
      edgeColor,
    );

    const sparkOffset = slot * this.config.sparksPerHit;
    for (let index = 0; index < this.config.sparksPerHit; index += 1) {
      const sparkIndex = sparkOffset + index;
      this.sparkMesh.setMatrixAt(sparkIndex, scratchMatrix);
      if (reducedMotion > 0.5) {
        this.sparkAttributes.startTimes.setX(sparkIndex, inactiveStartTime);
        continue;
      }
      const angle = random() * Math.PI * 2;
      const travelDistance = THREE.MathUtils.lerp(
        this.config.maxRadius * 1.32,
        this.config.maxRadius * 1.78,
        random(),
      );
      this.sparkAttributes.startTimes.setX(
        sparkIndex,
        startTime + THREE.MathUtils.lerp(0.025, 0.055, random()),
      );
      this.sparkAttributes.velocities.setXY(
        sparkIndex,
        Math.cos(angle) * travelDistance,
        Math.sin(angle) * travelDistance,
      );
      this.sparkAttributes.sizes.setXY(
        sparkIndex,
        THREE.MathUtils.lerp(0.018, 0.036, random()),
        THREE.MathUtils.lerp(0.22, 0.48, random()),
      );
      this.sparkAttributes.seeds.setX(sparkIndex, seed + index * 13.7);
      this.sparkAttributes.colors.setXYZ(sparkIndex, ringColor.r, ringColor.g, ringColor.b);
    }

    markLayerAttributesForUpdate(this.centerAttributes);
    markLayerAttributesForUpdate(this.ringAttributes);
    markSegmentAttributesForUpdate(this.segmentAttributes);
    this.centerMesh.instanceMatrix.needsUpdate = true;
    this.ringMesh.instanceMatrix.needsUpdate = true;
    this.segmentMesh.instanceMatrix.needsUpdate = true;
    this.sparkMesh.instanceMatrix.needsUpdate = true;
    this.sparkAttributes.startTimes.needsUpdate = true;
    if (reducedMotion < 0.5) {
      this.sparkAttributes.velocities.needsUpdate = true;
      this.sparkAttributes.sizes.needsUpdate = true;
      this.sparkAttributes.seeds.needsUpdate = true;
      this.sparkAttributes.colors.needsUpdate = true;
    }
  }

  update(deltaTime: number, _camera: THREE.Camera): void {
    if (this.disposed) {
      return;
    }
    this.time += Math.max(0, deltaTime);
    this.commonUniforms.uTime.value = this.time;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.centerGeometry.dispose();
    this.ringGeometry.dispose();
    this.segmentGeometry.dispose();
    this.sparkGeometry.dispose();
    this.centerMaterial.dispose();
    this.ringMaterial.dispose();
    this.segmentMaterial.dispose();
    this.sparkMaterial.dispose();
    for (const texture of new Set([
      this.fallbackTexture,
      this.centerAtlas,
      this.ringAtlas,
      this.segmentAtlas,
      this.dissolveTexture,
      this.gradientTexture,
    ])) {
      texture.dispose();
    }
    this.group.clear();
  }

  private async loadTextures(): Promise<void> {
    const [centerAtlas, ringAtlas, segmentAtlas, dissolveTexture, gradientTexture] = await Promise.all([
      createTextureAtlas(this.config.centerTextureUrls, this.config.atlasCellSize),
      createTextureAtlas(this.config.ringTextureUrls, this.config.atlasCellSize),
      createTextureAtlas(
        [...this.config.longTextureUrls, ...this.config.shortTextureUrls],
        this.config.atlasCellSize,
      ),
      createSingleTexture(this.config.dissolveTextureUrl),
      createSingleTexture(this.config.colorGradientTextureUrl),
    ]);
    if (this.disposed) {
      centerAtlas.texture.dispose();
      ringAtlas.texture.dispose();
      segmentAtlas.texture.dispose();
      dissolveTexture.dispose();
      gradientTexture.dispose();
      return;
    }
    this.centerAtlas = centerAtlas.texture;
    this.ringAtlas = ringAtlas.texture;
    this.segmentAtlas = segmentAtlas.texture;
    this.dissolveTexture = dissolveTexture;
    this.gradientTexture = gradientTexture;
    applyAtlas(this.centerAtlasUniforms, centerAtlas);
    applyAtlas(this.ringAtlasUniforms, ringAtlas);
    applyAtlas(this.segmentAtlasUniforms, segmentAtlas);
    this.commonUniforms.uDissolveMask.value = dissolveTexture;
    this.commonUniforms.uColorGradient.value = gradientTexture;
  }

  private writeLayerInstance(
    mesh: THREE.InstancedMesh,
    attributes: LayerAttributes,
    index: number,
    startTime: number,
    textureIndex: number,
    directionX: number,
    directionZ: number,
    seed: number,
    reducedMotion: number,
    color: THREE.Color,
  ): void {
    mesh.setMatrixAt(index, scratchMatrix);
    attributes.startTimes.setX(index, startTime);
    attributes.textureIndices.setX(index, textureIndex);
    attributes.directions.setXYZ(index, directionX, 0, directionZ);
    attributes.seeds.setX(index, seed);
    attributes.reducedMotion.setX(index, reducedMotion);
    attributes.colors.setXYZ(index, color.r, color.g, color.b);
  }

  private writeSegmentInstance(
    index: number,
    startTime: number,
    textureIndex: number,
    directionX: number,
    directionZ: number,
    angleOffset: number,
    sizeScale: number,
    seed: number,
    reducedMotion: number,
    color: THREE.Color,
  ): void {
    this.segmentMesh.setMatrixAt(index, scratchMatrix);
    this.segmentAttributes.startTimes.setX(index, startTime);
    this.segmentAttributes.textureIndices.setX(index, textureIndex);
    this.segmentAttributes.directions.setXYZ(index, directionX, 0, directionZ);
    this.segmentAttributes.angleOffsets.setX(index, angleOffset);
    this.segmentAttributes.sizeScales.setX(index, sizeScale);
    this.segmentAttributes.seeds.setX(index, seed);
    this.segmentAttributes.reducedMotion.setX(index, reducedMotion);
    this.segmentAttributes.colors.setXYZ(index, color.r, color.g, color.b);
  }
}

function normalizeConfig(config: Partial<HitVfxConfig>): HitVfxConfig {
  const normalized = {
    ...defaultHitVfxConfig,
    ...config,
    centerTextureUrls: [...(config.centerTextureUrls ?? defaultHitVfxConfig.centerTextureUrls)],
    ringTextureUrls: [...(config.ringTextureUrls ?? defaultHitVfxConfig.ringTextureUrls)],
    longTextureUrls: [...(config.longTextureUrls ?? defaultHitVfxConfig.longTextureUrls)],
    shortTextureUrls: [...(config.shortTextureUrls ?? defaultHitVfxConfig.shortTextureUrls)],
  };
  for (const [label, urls] of [
    ["center", normalized.centerTextureUrls],
    ["ring", normalized.ringTextureUrls],
    ["long", normalized.longTextureUrls],
    ["short", normalized.shortTextureUrls],
  ] as const) {
    if (urls.length === 0 || urls.some((url) => !url.trim())) {
      throw new Error(`VFX_Hit requires at least one valid ${label} texture URL`);
    }
  }
  normalized.poolSize = Math.max(1, Math.floor(normalized.poolSize));
  normalized.sparksPerHit = Math.max(0, Math.floor(normalized.sparksPerHit));
  normalized.duration = Math.max(0.1, normalized.duration);
  normalized.maxRadius = Math.max(0.1, normalized.maxRadius);
  normalized.intensity = Math.max(0, normalized.intensity);
  normalized.atlasCellSize = THREE.MathUtils.clamp(Math.floor(normalized.atlasCellSize), 64, 1024);
  return normalized;
}

function createLayerGeometry(count: number, pivotAtBase: boolean): {
  geometry: THREE.PlaneGeometry;
  attributes: LayerAttributes;
} {
  const geometry = new THREE.PlaneGeometry(1, 1);
  if (pivotAtBase) {
    geometry.translate(0, 0.5, 0);
  }
  const attributes: LayerAttributes = {
    startTimes: createInstancedAttribute(count, 1, inactiveStartTime),
    textureIndices: createInstancedAttribute(count, 1, 0),
    directions: createInstancedAttribute(count, 3, 0),
    seeds: createInstancedAttribute(count, 1, 0),
    reducedMotion: createInstancedAttribute(count, 1, 0),
    colors: createInstancedAttribute(count, 3, 1),
  };
  attachLayerAttributes(geometry, attributes);
  return { geometry, attributes };
}

function createSegmentGeometry(count: number): {
  geometry: THREE.PlaneGeometry;
  attributes: SegmentAttributes;
} {
  const base = createLayerGeometry(count, true);
  const attributes: SegmentAttributes = {
    ...base.attributes,
    angleOffsets: createInstancedAttribute(count, 1, 0),
    sizeScales: createInstancedAttribute(count, 1, 1),
  };
  base.geometry.setAttribute("aAngleOffset", attributes.angleOffsets);
  base.geometry.setAttribute("aSizeScale", attributes.sizeScales);
  return { geometry: base.geometry, attributes };
}

function createSparkGeometry(count: number): {
  geometry: THREE.PlaneGeometry;
  attributes: SparkAttributes;
} {
  const geometry = new THREE.PlaneGeometry(1, 1);
  geometry.translate(0, 0.5, 0);
  const attributes: SparkAttributes = {
    startTimes: createInstancedAttribute(count, 1, inactiveStartTime),
    velocities: createInstancedAttribute(count, 2, 0),
    sizes: createInstancedAttribute(count, 2, 0),
    seeds: createInstancedAttribute(count, 1, 0),
    colors: createInstancedAttribute(count, 3, 1),
  };
  geometry.setAttribute("aStartTime", attributes.startTimes);
  geometry.setAttribute("aVelocity", attributes.velocities);
  geometry.setAttribute("aSize", attributes.sizes);
  geometry.setAttribute("aSeed", attributes.seeds);
  geometry.setAttribute("aColor", attributes.colors);
  return { geometry, attributes };
}

function attachLayerAttributes(geometry: THREE.BufferGeometry, attributes: LayerAttributes): void {
  geometry.setAttribute("aStartTime", attributes.startTimes);
  geometry.setAttribute("aTextureIndex", attributes.textureIndices);
  geometry.setAttribute("aDirection", attributes.directions);
  geometry.setAttribute("aSeed", attributes.seeds);
  geometry.setAttribute("aReducedMotion", attributes.reducedMotion);
  geometry.setAttribute("aColor", attributes.colors);
}

function createInstancedAttribute(
  count: number,
  itemSize: number,
  initialValue: number,
): THREE.InstancedBufferAttribute {
  const values = new Float32Array(count * itemSize);
  if (initialValue !== 0) {
    values.fill(initialValue);
  }
  const attribute = new THREE.InstancedBufferAttribute(values, itemSize);
  attribute.setUsage(THREE.DynamicDrawUsage);
  return attribute;
}

function initializeInstanceMatrices(mesh: THREE.InstancedMesh, count: number): void {
  scratchMatrix.identity();
  for (let index = 0; index < count; index += 1) {
    mesh.setMatrixAt(index, scratchMatrix);
  }
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.instanceMatrix.needsUpdate = true;
}

function markLayerAttributesForUpdate(attributes: LayerAttributes): void {
  attributes.startTimes.needsUpdate = true;
  attributes.textureIndices.needsUpdate = true;
  attributes.directions.needsUpdate = true;
  attributes.seeds.needsUpdate = true;
  attributes.reducedMotion.needsUpdate = true;
  attributes.colors.needsUpdate = true;
}

function markSegmentAttributesForUpdate(attributes: SegmentAttributes): void {
  markLayerAttributesForUpdate(attributes);
  attributes.angleOffsets.needsUpdate = true;
  attributes.sizeScales.needsUpdate = true;
}

function createAtlasUniforms(texture: THREE.Texture): AtlasUniforms {
  return {
    uAtlas: { value: texture },
    uAtlasGrid: { value: 1 },
    uTextureCount: { value: 0 },
  };
}

function applyAtlas(
  uniforms: AtlasUniforms,
  atlas: { texture: THREE.Texture; gridSize: number; count: number },
): void {
  uniforms.uAtlas.value = atlas.texture;
  uniforms.uAtlasGrid.value = atlas.gridSize;
  uniforms.uTextureCount.value = atlas.count;
}

function createCenterMaterial(common: CommonUniforms, atlas: AtlasUniforms): THREE.ShaderMaterial {
  return createAdditiveMaterial({
    uniforms: { ...common, ...atlas },
    vertexShader: `${layerVertexDeclarations}
      void main() {
        float age = uTime - aStartTime;
        float pop = smoothstep(0.0, 0.025, age);
        float expansion = smoothstep(0.025, 0.08, age);
        float shrink = smoothstep(0.1, 0.25, age);
        float peakScale = mix(0.56, 0.68, expansion);
        float scale = pop * mix(peakScale, 0.055, shrink);
        if (aReducedMotion > 0.5) {
          scale = smoothstep(0.0, 0.025, age) * mix(0.5, 0.26, smoothstep(0.06, 0.18, age));
        }
        vec2 screenOffset = position.xy * uMaxRadius * 1.45 * scale;
        setBillboardPosition(screenOffset);
        vUv = uv;
        vEffectUv = screenOffset / (uMaxRadius * 2.0) + 0.5;
        setLayerVaryings(age);
      }
    `,
    fragmentShader: `${layerFragmentDeclarations}
      void main() {
        float endAge = mix(uDuration, 0.18, vReducedMotion);
        if (vAge < 0.0 || vAge > endAge) discard;
        float mask = smoothstep(0.04, 0.52, sampleAtlas(vUv, vTextureIndex));
        float normalLife = smoothstep(0.0, 0.02, vAge)
          * (1.0 - smoothstep(0.1, 0.25, vAge));
        float reducedLife = smoothstep(0.0, 0.02, vAge)
          * (1.0 - smoothstep(0.06, 0.18, vAge));
        float life = mix(normalLife, reducedLife, vReducedMotion);
        float gradient = clamp(texture2D(uColorGradient, vEffectUv).r, 0.0, 1.0);
        float whiteWeight = pow(gradient, 3.2) * 0.62;
        vec3 color = mix(vColor, vec3(1.0), whiteWeight);
        gl_FragColor = vec4(color * uIntensity * 0.9, mask * life);
      }
    `,
  });
}

function createRingMaterial(common: CommonUniforms, atlas: AtlasUniforms): THREE.ShaderMaterial {
  return createAdditiveMaterial({
    uniforms: { ...common, ...atlas },
    vertexShader: `${layerVertexDeclarations}
      void main() {
        float age = uTime - aStartTime;
        float pop = smoothstep(0.0, 0.025, age);
        float primaryGrowth = smoothstep(0.025, 0.085, age);
        float continuedGrowth = smoothstep(0.085, 0.28, age);
        float scale = pop * (mix(0.42, 0.78, primaryGrowth) + continuedGrowth * 0.3);
        if (aReducedMotion > 0.5) scale = 0.46;
        float randomAngle = fract(sin(aSeed * 12.9898) * 43758.5453) * 6.28318530718;
        float angleSine = sin(randomAngle);
        float angleCosine = cos(randomAngle);
        vec2 rotatedPosition = vec2(
          position.x * angleCosine - position.y * angleSine,
          position.x * angleSine + position.y * angleCosine
        );
        vec2 screenOffset = rotatedPosition * uMaxRadius * 2.0 * scale;
        setBillboardPosition(screenOffset);
        vUv = uv;
        vEffectUv = screenOffset / (uMaxRadius * 2.0) + 0.5;
        setLayerVaryings(age);
      }
    `,
    fragmentShader: `${layerFragmentDeclarations}
      void main() {
        float endAge = mix(uDuration, 0.18, vReducedMotion);
        if (vAge < 0.0 || vAge > endAge) discard;
        float mask = smoothstep(0.04, 0.48, sampleAtlas(vUv, vTextureIndex));
        float normalLife = smoothstep(0.0, 0.02, vAge)
          * (1.0 - smoothstep(0.41, 0.42, vAge));
        float reducedLife = smoothstep(0.0, 0.02, vAge)
          * (1.0 - smoothstep(0.08, 0.18, vAge));
        float life = mix(normalLife, reducedLife, vReducedMotion);
        float dissolve = sampleDissolve(vEffectUv, vAge, vSeed);
        gl_FragColor = vec4(vColor * uIntensity, mask * life * dissolve);
      }
    `,
  });
}

function createSegmentMaterial(common: CommonUniforms, atlas: AtlasUniforms): THREE.ShaderMaterial {
  return createAdditiveMaterial({
    uniforms: { ...common, ...atlas },
    vertexShader: `${layerVertexDeclarations}
      attribute float aAngleOffset;
      attribute float aSizeScale;

      vec2 rotate2d(vec2 value, float angle) {
        float sine = sin(angle);
        float cosine = cos(angle);
        return vec2(value.x * cosine - value.y * sine, value.x * sine + value.y * cosine);
      }

      void main() {
        float age = uTime - aStartTime;
        vec3 cameraRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 cameraUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        vec2 projectedDirection = vec2(dot(aDirection, cameraRight), dot(aDirection, cameraUp));
        if (dot(projectedDirection, projectedDirection) < 0.0001) projectedDirection = vec2(1.0, 0.0);
        projectedDirection = normalize(projectedDirection);
        vec2 rayDirection = rotate2d(projectedDirection, aAngleOffset);
        vec2 raySide = vec2(-rayDirection.y, rayDirection.x);
        float reveal = smoothstep(0.095, 0.14, age);
        if (aReducedMotion > 0.5) reveal = smoothstep(0.0, 0.025, age) * 0.5;
        float continuedGrowth = mix(1.0, 1.15, smoothstep(0.14, 0.28, age));
        float length = uMaxRadius * 0.98 * aSizeScale * reveal * continuedGrowth;
        float width = uMaxRadius * 0.29 * aSizeScale * mix(0.7, 1.0, reveal) * continuedGrowth;
        vec2 screenOffset = raySide * position.x * width + rayDirection * position.y * length;
        setBillboardPosition(screenOffset);
        vUv = uv;
        vEffectUv = screenOffset / (uMaxRadius * 2.0) + 0.5;
        setLayerVaryings(age);
      }
    `,
    fragmentShader: `${layerFragmentDeclarations}
      void main() {
        float endAge = mix(0.5, 0.18, vReducedMotion);
        if (vAge < 0.0 || vAge > endAge) discard;
        vec2 flippedUv = vec2(vUv.x, 1.0 - vUv.y);
        float mask = smoothstep(0.04, 0.52, sampleAtlas(flippedUv, vTextureIndex));
        float normalLife = smoothstep(0.095, 0.14, vAge)
          * (1.0 - smoothstep(0.48, 0.5, vAge));
        float reducedLife = smoothstep(0.0, 0.025, vAge)
          * (1.0 - smoothstep(0.09, 0.18, vAge));
        float life = mix(normalLife, reducedLife, vReducedMotion);
        float dissolve = sampleSegmentDissolve(vEffectUv, vAge, vSeed);
        float gradient = clamp(texture2D(uColorGradient, vEffectUv).r, 0.0, 1.0);
        float whiteWeight = pow(gradient, 3.0) * 0.55;
        vec3 color = mix(vColor, vec3(1.0), whiteWeight);
        gl_FragColor = vec4(color * uIntensity * 0.9, mask * life * dissolve);
      }
    `,
  });
}

function createSparkMaterial(common: CommonUniforms): THREE.ShaderMaterial {
  return createAdditiveMaterial({
    uniforms: {
      uTime: common.uTime,
      uIntensity: common.uIntensity,
    },
    vertexShader: `
      attribute float aStartTime;
      attribute vec2 aVelocity;
      attribute vec2 aSize;
      attribute float aSeed;
      attribute vec3 aColor;
      uniform float uTime;
      varying vec2 vUv;
      varying float vLife;
      varying float vSeed;
      varying vec3 vColor;

      void main() {
        float age = uTime - aStartTime;
        vLife = age / 0.34;
        vec2 direction = normalize(aVelocity);
        vec2 side = vec2(-direction.y, direction.x);
        float travelProgress = 1.0 - pow(1.0 - clamp(vLife, 0.0, 1.0), 2.2);
        vec2 centerOffset = aVelocity * travelProgress;
        vec2 screenOffset = centerOffset
          + direction * position.y * aSize.y * (1.0 - 0.35 * clamp(vLife, 0.0, 1.0))
          + side * position.x * aSize.x;
        vec3 center = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vec3 cameraRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 cameraUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        vec3 worldPosition = center + cameraRight * screenOffset.x + cameraUp * screenOffset.y;
        gl_Position = projectionMatrix * viewMatrix * vec4(worldPosition, 1.0);
        vUv = uv;
        vSeed = aSeed;
        vColor = aColor;
      }
    `,
    fragmentShader: `
      uniform float uIntensity;
      varying vec2 vUv;
      varying float vLife;
      varying float vSeed;
      varying vec3 vColor;

      void main() {
        if (vLife < 0.0 || vLife > 1.0) discard;
        float width = 1.0 - smoothstep(0.08, 0.5, abs(vUv.x - 0.5));
        float taper = smoothstep(0.0, 0.12, vUv.y) * (1.0 - smoothstep(0.42, 1.0, vUv.y));
        float life = smoothstep(0.0, 0.045, vLife) * (1.0 - smoothstep(0.58, 1.0, vLife));
        float shimmer = 0.84 + 0.16 * sin(vSeed * 0.73);
        float alpha = width * taper * life * shimmer;
        gl_FragColor = vec4(mix(vColor, vec3(1.0), vUv.y * 0.42) * uIntensity, alpha);
      }
    `,
  });
}

const layerVertexDeclarations = `
  attribute float aStartTime;
  attribute float aTextureIndex;
  attribute vec3 aDirection;
  attribute float aSeed;
  attribute float aReducedMotion;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uDuration;
  uniform float uMaxRadius;
  varying vec2 vUv;
  varying vec2 vEffectUv;
  varying float vAge;
  varying float vTextureIndex;
  varying float vSeed;
  varying float vReducedMotion;
  varying vec3 vColor;

  void setBillboardPosition(vec2 screenOffset) {
    vec3 center = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vec3 cameraRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 cameraUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    vec3 worldPosition = center + cameraRight * screenOffset.x + cameraUp * screenOffset.y;
    gl_Position = projectionMatrix * viewMatrix * vec4(worldPosition, 1.0);
  }

  void setLayerVaryings(float age) {
    vAge = age;
    vTextureIndex = aTextureIndex;
    vSeed = aSeed;
    vReducedMotion = aReducedMotion;
    vColor = aColor;
  }
`;

const layerFragmentDeclarations = `
  uniform sampler2D uAtlas;
  uniform float uAtlasGrid;
  uniform float uTextureCount;
  uniform sampler2D uDissolveMask;
  uniform sampler2D uColorGradient;
  uniform float uDuration;
  uniform float uIntensity;
  varying vec2 vUv;
  varying vec2 vEffectUv;
  varying float vAge;
  varying float vTextureIndex;
  varying float vSeed;
  varying float vReducedMotion;
  varying vec3 vColor;

  vec2 rotate2dFragment(vec2 value, float angle) {
    float sine = sin(angle);
    float cosine = cos(angle);
    return vec2(value.x * cosine - value.y * sine, value.x * sine + value.y * cosine);
  }

  float sampleAtlas(vec2 localUv, float textureIndex) {
    if (uTextureCount < 0.5) return 0.0;
    float safeIndex = mod(floor(textureIndex + 0.5), uTextureCount);
    float column = mod(safeIndex, uAtlasGrid);
    float row = floor(safeIndex / uAtlasGrid);
    vec2 cellUv = mix(vec2(0.004), vec2(0.996), clamp(localUv, 0.0, 1.0));
    return texture2D(uAtlas, (cellUv + vec2(column, row)) / uAtlasGrid).r;
  }

  float sampleDissolve(vec2 effectUv, float age, float seed) {
    float progress = smoothstep(0.24, 0.41, age);
    vec2 dissolveUv = rotate2dFragment(effectUv - 0.5, seed * 0.071) * 1.25 + 0.5;
    float inside = step(0.0, dissolveUv.x) * step(dissolveUv.x, 1.0)
      * step(0.0, dissolveUv.y) * step(dissolveUv.y, 1.0);
    float breakup = texture2D(uDissolveMask, clamp(dissolveUv, 0.0, 1.0)).r * inside;
    float irregularRadius = length(effectUv - 0.5) * 2.0 - breakup * 0.26 + 0.03;
    float frontRadius = mix(-0.08, 1.7, progress);
    float visibleOutsideFront = smoothstep(frontRadius - 0.07, frontRadius + 0.07, irregularRadius);
    return mix(1.0, visibleOutsideFront, smoothstep(0.24, 0.255, age));
  }

  float sampleSegmentDissolve(vec2 effectUv, float age, float seed) {
    float progress = smoothstep(0.27, 0.49, age);
    vec2 dissolveUv = rotate2dFragment(effectUv - 0.5, seed * 0.071) * 1.25 + 0.5;
    float inside = step(0.0, dissolveUv.x) * step(dissolveUv.x, 1.0)
      * step(0.0, dissolveUv.y) * step(dissolveUv.y, 1.0);
    float breakup = texture2D(uDissolveMask, clamp(dissolveUv, 0.0, 1.0)).r * inside;
    float irregularRadius = length(effectUv - 0.5) * 2.0 - breakup * 0.22 + 0.02;
    float frontRadius = mix(-0.06, 1.4, progress);
    float visibleOutsideFront = smoothstep(frontRadius - 0.06, frontRadius + 0.06, irregularRadius);
    return mix(1.0, visibleOutsideFront, smoothstep(0.27, 0.285, age));
  }
`;

function createAdditiveMaterial(parameters: {
  uniforms: Record<string, { value: unknown }>;
  vertexShader: string;
  fragmentShader: string;
}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    ...parameters,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

function createFallbackTexture(): THREE.DataTexture {
  const texture = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat);
  configureMaskTexture(texture, "VFX_Hit Fallback");
  return texture;
}

async function createTextureAtlas(
  urls: readonly string[],
  cellSize: number,
): Promise<{ texture: THREE.CanvasTexture; gridSize: number; count: number }> {
  const images = await Promise.all(urls.map(loadImage));
  const gridSize = Math.ceil(Math.sqrt(images.length));
  const canvas = document.createElement("canvas");
  canvas.width = gridSize * cellSize;
  canvas.height = gridSize * cellSize;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    throw new Error("VFX_Hit could not create a texture atlas");
  }
  context.fillStyle = "#000000";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const padding = 2;
  for (let index = 0; index < images.length; index += 1) {
    const column = index % gridSize;
    const row = Math.floor(index / gridSize);
    context.drawImage(
      images[index],
      column * cellSize + padding,
      row * cellSize + padding,
      cellSize - padding * 2,
      cellSize - padding * 2,
    );
  }
  const texture = new THREE.CanvasTexture(canvas);
  configureMaskTexture(texture, "VFX_Hit Runtime Atlas");
  return { texture, gridSize, count: images.length };
}

async function createSingleTexture(url: string): Promise<THREE.CanvasTexture> {
  const image = await loadImage(url);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    throw new Error(`VFX_Hit could not create texture canvas for ${url}`);
  }
  context.drawImage(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  configureMaskTexture(texture, `VFX_Hit ${url}`);
  return texture;
}

function configureMaskTexture(texture: THREE.Texture, name: string): void {
  texture.name = name;
  texture.colorSpace = THREE.NoColorSpace;
  texture.flipY = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`VFX_Hit failed to load texture: ${url}`));
    image.src = url;
  });
}

function createSeededRandom(seed: number): () => number {
  let state = Math.floor(seed) >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
