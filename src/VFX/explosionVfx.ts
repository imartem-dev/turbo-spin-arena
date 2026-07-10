import * as THREE from "three";

export type ExplosionVfxConfig = {
  poolSize: number;
  cloudCount: number;
  streakCount: number;
  duration: number;
  cloudLifetime: number;
  cloudSpeed: number;
  cloudScaleMin: number;
  cloudScaleMax: number;
  cloudDisplacement: number;
  cloudRadialNormalBlend: number;
  cloudSharedNoiseScale: number;
  cloudOutlineColor: string;
  cloudOutlineThickness: number;
  cloudFireCoreColor: string;
  cloudFireGlowColor: string;
  cloudFireShadowColor: string;
  cloudSmokeCoreColor: string;
  cloudSmokeGlowColor: string;
  cloudSmokeShadowColor: string;
  cloudLightDirection: [number, number, number];
  cloudNoiseLightingStrength: number;
  cloudShadowThreshold: number;
  cloudCoreThreshold: number;
  emissionColor: string;
  emissionPeak: number;
  streakLifetime: number;
  streakLength: number;
  streakSpeed: number;
  streakColor: string;
  flareScale: number;
  flareDuration: number;
  crackScale: number;
  crackDuration: number;
};

type ExplosionTextures = {
  cloudNoise: THREE.Texture;
  cloudDetail: THREE.Texture;
  dissolve: THREE.Texture;
  streaks: THREE.Texture[];
  flare: THREE.Texture;
  cracks: THREE.Texture;
};

const explosionTextureBase = `${import.meta.env.BASE_URL}assets/vfx/explosion/`;

export const defaultExplosionVfxConfig: ExplosionVfxConfig = {
  poolSize: 5,
  cloudCount: 34,
  streakCount: 42,
  duration: 1.55,
  cloudLifetime: 1.25,
  cloudSpeed: 1.35,
  cloudScaleMin: 0.58,
  cloudScaleMax: 0.92,
  cloudDisplacement: 0.34,
  cloudRadialNormalBlend: 0.72,
  cloudSharedNoiseScale: 0.2,
  cloudOutlineColor: "#251417",
  cloudOutlineThickness: 0.04,
  cloudFireCoreColor: "#fff9a2",
  cloudFireGlowColor: "#ff8800",
  cloudFireShadowColor: "#ca0000",
  cloudSmokeCoreColor: "#76655c",
  cloudSmokeGlowColor: "#493a35",
  cloudSmokeShadowColor: "#1c1718",
  cloudLightDirection: [0, -0.9, 0.68],
  cloudNoiseLightingStrength: 0.99,
  cloudShadowThreshold: 0.3,
  cloudCoreThreshold: 0.5,
  emissionColor: "#fd8700",
  emissionPeak: 3.8,
  streakLifetime: 0.42,
  streakLength: 1.55,
  streakSpeed: 4.6,
  streakColor: "#ffcf58",
  flareScale: 4.8,
  flareDuration: 0.26,
  crackScale: 3.6,
  crackDuration: 1.35,
};

const identityMatrix = new THREE.Matrix4();

export class ExplosionVfxPool {
  readonly group = new THREE.Group();

  private readonly config: ExplosionVfxConfig;
  private readonly textures: ExplosionTextures;
  private readonly instances: ExplosionVfxInstance[];
  private nextIndex = 0;

  constructor(config: Partial<ExplosionVfxConfig> = {}) {
    this.config = { ...defaultExplosionVfxConfig, ...config };
    this.group.name = "Explosion VFX Pool";
    this.textures = loadExplosionTextures();
    this.instances = Array.from({ length: this.config.poolSize }, (_, index) => {
      const instance = new ExplosionVfxInstance(this.config, this.textures, index);
      this.group.add(instance.group);
      return instance;
    });
  }

  spawn(position: THREE.Vector3): void {
    const instance = this.instances[this.nextIndex];
    this.nextIndex = (this.nextIndex + 1) % this.instances.length;
    instance.spawn(position);
  }

  update(deltaTime: number, elapsedTime: number, camera: THREE.Camera): void {
    for (const instance of this.instances) {
      instance.update(deltaTime, elapsedTime, camera);
    }
  }

  dispose(): void {
    for (const instance of this.instances) {
      instance.dispose();
    }
    for (const texture of [
      this.textures.cloudNoise,
      this.textures.cloudDetail,
      this.textures.dissolve,
      this.textures.flare,
      this.textures.cracks,
      ...this.textures.streaks,
    ]) {
      texture.dispose();
    }
  }
}

class ExplosionVfxInstance {
  readonly group = new THREE.Group();

  private readonly config: ExplosionVfxConfig;
  private readonly cloudMaterial: THREE.ShaderMaterial;
  private readonly cloudOutlineMaterial: THREE.ShaderMaterial;
  private readonly streakMaterial: THREE.ShaderMaterial;
  private readonly flareMaterial: THREE.ShaderMaterial;
  private readonly cracksMaterial: THREE.ShaderMaterial;
  private readonly cloudMesh: THREE.InstancedMesh;
  private readonly cloudOutlineMesh: THREE.InstancedMesh;
  private readonly streakMesh: THREE.InstancedMesh;
  private readonly flareMesh: THREE.Mesh;
  private readonly cracksMesh: THREE.Mesh;
  private readonly airGroup = new THREE.Group();
  private readonly cameraRight = new THREE.Vector3(1, 0, 0);
  private readonly cameraUp = new THREE.Vector3(0, 1, 0);
  private age = 0;
  private active = false;

  constructor(config: ExplosionVfxConfig, textures: ExplosionTextures, index: number) {
    this.config = config;
    this.group.name = `Explosion VFX ${index}`;
    this.group.visible = false;

    const cloudGeometry = createCloudGeometry(config.cloudCount);
    this.cloudMaterial = createCloudMaterial(config, textures);
    this.cloudMesh = new THREE.InstancedMesh(cloudGeometry, this.cloudMaterial, config.cloudCount);
    this.cloudMesh.name = "Explosion Clouds";
    this.cloudMesh.frustumCulled = false;
    this.cloudMesh.renderOrder = 2;
    initializeInstanceMatrices(this.cloudMesh, config.cloudCount);

    this.cloudOutlineMaterial = createCloudOutlineMaterial(config, textures);
    this.cloudOutlineMesh = new THREE.InstancedMesh(cloudGeometry, this.cloudOutlineMaterial, config.cloudCount);
    this.cloudOutlineMesh.name = "Explosion Cloud Outline";
    this.cloudOutlineMesh.frustumCulled = false;
    this.cloudOutlineMesh.renderOrder = 1;
    initializeInstanceMatrices(this.cloudOutlineMesh, config.cloudCount);

    this.streakMaterial = createStreakMaterial(config, textures.streaks);
    const streakGeometry = createStreakGeometry(config.streakCount);
    this.streakMesh = new THREE.InstancedMesh(streakGeometry, this.streakMaterial, config.streakCount);
    this.streakMesh.name = "Explosion Streaks";
    this.streakMesh.frustumCulled = false;
    this.streakMesh.renderOrder = 4;
    initializeInstanceMatrices(this.streakMesh, config.streakCount);

    this.flareMaterial = createFlareMaterial(config, textures.flare);
    this.flareMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.flareMaterial);
    this.flareMesh.name = "Explosion Flare";
    this.flareMesh.renderOrder = 5;
    this.flareMesh.frustumCulled = false;

    this.cracksMaterial = createCracksMaterial(config, textures.cracks);
    this.cracksMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.cracksMaterial);
    this.cracksMesh.name = "Explosion Ground Cracks";
    this.cracksMesh.rotation.x = -Math.PI / 2;
    this.cracksMesh.position.y = 0.018;
    this.cracksMesh.renderOrder = 2;
    this.cracksMesh.frustumCulled = false;

    this.airGroup.name = "Explosion Air Effects";
    this.airGroup.position.y = config.cloudScaleMax + 0.08;
    this.airGroup.add(
      this.cloudOutlineMesh,
      this.cloudMesh,
      this.streakMesh,
      this.flareMesh,
    );
    this.group.add(this.cracksMesh, this.airGroup);
  }

  spawn(position: THREE.Vector3): void {
    this.age = 0;
    this.active = true;
    this.group.visible = true;
    this.group.position.copy(position);
  }

  update(deltaTime: number, elapsedTime: number, camera: THREE.Camera): void {
    if (!this.active) {
      return;
    }

    this.age += deltaTime;
    if (this.age >= this.config.duration) {
      this.active = false;
      this.group.visible = false;
      return;
    }

    camera.matrixWorld.extractBasis(this.cameraRight, this.cameraUp, scratchForward);
    this.flareMesh.quaternion.copy(camera.quaternion);

    setUniform(this.cloudMaterial, "uAge", this.age);
    setUniform(this.cloudMaterial, "uTime", elapsedTime);
    setUniform(this.cloudOutlineMaterial, "uAge", this.age);
    setUniform(this.cloudOutlineMaterial, "uTime", elapsedTime);
    setUniform(this.streakMaterial, "uAge", this.age);
    setUniform(this.streakMaterial, "uTime", elapsedTime);
    setUniform(this.streakMaterial, "uCameraRight", this.cameraRight);
    setUniform(this.streakMaterial, "uCameraUp", this.cameraUp);
    setUniform(this.flareMaterial, "uAge", this.age);
    setUniform(this.cracksMaterial, "uAge", this.age);

  }

  dispose(): void {
    this.cloudMesh.geometry.dispose();
    this.streakMesh.geometry.dispose();
    this.flareMesh.geometry.dispose();
    this.cracksMesh.geometry.dispose();
    this.cloudMaterial.dispose();
    this.cloudOutlineMaterial.dispose();
    this.streakMaterial.dispose();
    this.flareMaterial.dispose();
    this.cracksMaterial.dispose();
  }
}

const scratchForward = new THREE.Vector3();

function loadExplosionTextures(): ExplosionTextures {
  const loader = new THREE.TextureLoader();
  const cloudNoise = loader.load(`${explosionTextureBase}T_CloudNoise_Tiled.webp`);
  const cloudDetail = loader.load(`${explosionTextureBase}T_PerlinNoise_Tiled.webp`);
  const dissolve = loader.load(`${explosionTextureBase}T_VFX_exp_dissapear.webp`);
  const flare = loader.load(`${explosionTextureBase}T_flare8_vfx.webp`);
  const cracks = loader.load(`${explosionTextureBase}T_Cracks336.webp`);
  const streaks = ["T_Windstreak3.webp", "T_trail12.webp", "T_VFX_spark44.webp"].map((file) =>
    loader.load(`${explosionTextureBase}${file}`),
  );

  for (const texture of [cloudNoise, cloudDetail, dissolve]) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
  }
  for (const texture of [flare, cracks, ...streaks]) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }
  for (const texture of [cloudNoise, cloudDetail, dissolve, flare, cracks, ...streaks]) {
    texture.needsUpdate = true;
  }

  return { cloudNoise, cloudDetail, dissolve, flare, cracks, streaks };
}

function createCloudGeometry(count: number): THREE.SphereGeometry {
  const geometry = new THREE.SphereGeometry(1, 24, 12);
  const directions = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  const delays = new Float32Array(count);
  const speeds = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    const direction = seededDirection(19, i);
    const radialFactor = THREE.MathUtils.lerp(0.12, 1, seededRandom(43, i, 0) ** 1.8);
    directions[i * 3] = direction.x * radialFactor;
    directions[i * 3 + 1] = (Math.abs(direction.y) * 0.48 + 0.1) * radialFactor;
    directions[i * 3 + 2] = direction.z * radialFactor;
    scales[i] = THREE.MathUtils.clamp(
      1.02 - radialFactor * 0.5 + (seededRandom(31, i, 1) - 0.5) * 0.16,
      0.46,
      1,
    );
    delays[i] = seededRandom(31, i, 2) * 0.08;
    speeds[i] = THREE.MathUtils.lerp(0.82, 1.08, seededRandom(31, i, 3));
  }

  geometry.setAttribute("instanceDirection", new THREE.InstancedBufferAttribute(directions, 3));
  geometry.setAttribute("instanceScale", new THREE.InstancedBufferAttribute(scales, 1));
  geometry.setAttribute("instanceDelay", new THREE.InstancedBufferAttribute(delays, 1));
  geometry.setAttribute("instanceSpeed", new THREE.InstancedBufferAttribute(speeds, 1));
  return geometry;
}

function createStreakGeometry(count: number): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(1, 1);
  geometry.translate(0, 0.5, 0);

  const directions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const sizes = new Float32Array(count * 2);
  const delays = new Float32Array(count);
  const speeds = new Float32Array(count);
  const textureIndices = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    const direction = seededDirection(71, i);
    directions[i * 3] = direction.x;
    directions[i * 3 + 1] = Math.abs(direction.y) * 0.4 + 0.1;
    directions[i * 3 + 2] = direction.z;
    seeds[i] = seededRandom(83, i, 0);
    sizes[i * 2] = THREE.MathUtils.lerp(0.06, 0.13, seededRandom(83, i, 1));
    sizes[i * 2 + 1] = THREE.MathUtils.lerp(0.75, 1.45, seededRandom(83, i, 2));
    delays[i] = seededRandom(83, i, 3) * 0.06;
    speeds[i] = THREE.MathUtils.lerp(0.8, 1.35, seededRandom(83, i, 4));
    textureIndices[i] = Math.floor(seededRandom(83, i, 5) * 3);
  }

  geometry.setAttribute("instanceDirection", new THREE.InstancedBufferAttribute(directions, 3));
  geometry.setAttribute("instanceSeed", new THREE.InstancedBufferAttribute(seeds, 1));
  geometry.setAttribute("instanceSize", new THREE.InstancedBufferAttribute(sizes, 2));
  geometry.setAttribute("instanceDelay", new THREE.InstancedBufferAttribute(delays, 1));
  geometry.setAttribute("instanceSpeed", new THREE.InstancedBufferAttribute(speeds, 1));
  geometry.setAttribute("instanceTexture", new THREE.InstancedBufferAttribute(textureIndices, 1));
  return geometry;
}

function createCloudMaterial(config: ExplosionVfxConfig, textures: ExplosionTextures): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...createCloudShapeUniforms(config, textures, 0),
      uFireCoreColor: { value: new THREE.Color(config.cloudFireCoreColor) },
      uFireGlowColor: { value: new THREE.Color(config.cloudFireGlowColor) },
      uFireShadowColor: { value: new THREE.Color(config.cloudFireShadowColor) },
      uSmokeCoreColor: { value: new THREE.Color(config.cloudSmokeCoreColor) },
      uSmokeGlowColor: { value: new THREE.Color(config.cloudSmokeGlowColor) },
      uSmokeShadowColor: { value: new THREE.Color(config.cloudSmokeShadowColor) },
      uLightDirection: { value: new THREE.Vector3().fromArray(config.cloudLightDirection).normalize() },
      uNoiseLightingStrength: { value: config.cloudNoiseLightingStrength },
      uShadowThreshold: { value: config.cloudShadowThreshold },
      uCoreThreshold: { value: config.cloudCoreThreshold },
      uEmissionPeak: { value: config.emissionPeak },
    },
    vertexShader: cloudVertexShader,
    fragmentShader: cloudFragmentShader,
    transparent: false,
    depthWrite: true,
    depthTest: true,
  });
}

function createCloudOutlineMaterial(
  config: ExplosionVfxConfig,
  textures: ExplosionTextures,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...createCloudShapeUniforms(config, textures, config.cloudOutlineThickness),
      uOutlineColor: { value: new THREE.Color(config.cloudOutlineColor) },
    },
    vertexShader: cloudVertexShader,
    fragmentShader: cloudOutlineFragmentShader,
    side: THREE.BackSide,
    transparent: false,
    depthWrite: true,
    depthTest: true,
  });
}

function createCloudShapeUniforms(
  config: ExplosionVfxConfig,
  textures: ExplosionTextures,
  outlineThickness: number,
) {
  return {
    uAge: { value: 0 },
    uTime: { value: 0 },
    uNoiseTex: { value: textures.cloudNoise },
    uDetailTex: { value: textures.cloudDetail },
    uDissolveTex: { value: textures.dissolve },
    uCloudLifetime: { value: config.cloudLifetime },
    uCloudSpeed: { value: config.cloudSpeed },
    uDisplacement: { value: config.cloudDisplacement },
    uScaleMin: { value: config.cloudScaleMin },
    uScaleMax: { value: config.cloudScaleMax },
    uRadialNormalBlend: { value: config.cloudRadialNormalBlend },
    uSharedNoiseScale: { value: config.cloudSharedNoiseScale },
    uOutlineThickness: { value: outlineThickness },
  };
}

function createStreakMaterial(config: ExplosionVfxConfig, textures: THREE.Texture[]): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uAge: { value: 0 },
      uTime: { value: 0 },
      uTextures: { value: textures },
      uStreakLifetime: { value: config.streakLifetime },
      uStreakLength: { value: config.streakLength },
      uStreakSpeed: { value: config.streakSpeed },
      uStreakColor: { value: new THREE.Color(config.streakColor) },
      uCameraRight: { value: new THREE.Vector3(1, 0, 0) },
      uCameraUp: { value: new THREE.Vector3(0, 1, 0) },
    },
    vertexShader: streakVertexShader,
    fragmentShader: streakFragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
  });
}

function createFlareMaterial(config: ExplosionVfxConfig, texture: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uAge: { value: 0 },
      uTexture: { value: texture },
      uDuration: { value: config.flareDuration },
      uScale: { value: config.flareScale },
      uColor: { value: new THREE.Color(config.emissionColor) },
    },
    vertexShader: flareVertexShader,
    fragmentShader: flareFragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });
}

function createCracksMaterial(config: ExplosionVfxConfig, texture: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uAge: { value: 0 },
      uTexture: { value: texture },
      uDuration: { value: config.crackDuration },
      uScale: { value: config.crackScale },
      uColor: { value: new THREE.Color(config.emissionColor) },
    },
    vertexShader: cracksVertexShader,
    fragmentShader: cracksFragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
  });
}

function initializeInstanceMatrices(mesh: THREE.InstancedMesh, count: number): void {
  for (let i = 0; i < count; i += 1) {
    mesh.setMatrixAt(i, identityMatrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
}

function setUniform(material: THREE.ShaderMaterial, name: string, value: number | THREE.Vector3): void {
  const uniform = material.uniforms[name];
  if (!uniform) {
    return;
  }
  if (value instanceof THREE.Vector3) {
    uniform.value.copy(value);
  } else {
    uniform.value = value;
  }
}

function seededDirection(seed: number, index: number): THREE.Vector3 {
  const angle = seededRandom(seed, index, 1) * Math.PI * 2;
  const y = seededRandom(seed, index, 2) * 1.6 - 0.35;
  const radius = Math.sqrt(Math.max(0.001, 1 - Math.min(Math.abs(y), 0.92) ** 2));
  return new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius).normalize();
}

function seededRandom(seed: number, a: number, b: number): number {
  return THREE.MathUtils.seededRandom(seed * 1009 + a * 9176 + b * 131);
}

function smoothStep01(value: number): number {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

const cloudVertexShader = `
  uniform float uAge;
  uniform float uTime;
  uniform sampler2D uNoiseTex;
  uniform float uCloudLifetime;
  uniform float uCloudSpeed;
  uniform float uDisplacement;
  uniform float uScaleMin;
  uniform float uScaleMax;
  uniform float uRadialNormalBlend;
  uniform float uSharedNoiseScale;
  uniform float uOutlineThickness;

  attribute vec3 instanceDirection;
  attribute float instanceScale;
  attribute float instanceDelay;
  attribute float instanceSpeed;

  varying vec2 vNoiseUvXZ;
  varying vec2 vNoiseUvXY;
  varying float vLife;
  varying float vParticleAge;
  varying float vSharedNoise;
  varying vec3 vWorldNormal;

  void main() {
    float particleAge = max(uAge - instanceDelay, 0.0);
    float age = clamp(particleAge / max(uCloudLifetime, 0.001), 0.0, 1.0);
    float appear = smoothstep(0.0, 0.16, age);
    float travel = (1.0 - exp(-age * 4.2)) * uCloudSpeed * instanceSpeed;
    float scaleCurve = mix(uScaleMin, uScaleMax, instanceScale) * appear * (1.0 + age * 0.86);
    vec3 cloudCenter = instanceDirection * travel;
    cloudCenter.y += age * 0.42;
    vec3 undeformedPosition = position * scaleCurve + cloudCenter;
    vec3 radialNormal = normalize(undeformedPosition + normal * 0.001);
    vec3 blendedNormal = normalize(mix(normal, radialNormal, uRadialNormalBlend));

    vec2 noiseOffset = vec2(uTime * 0.11, -uTime * 0.07);
    vec2 noiseUvXZ = undeformedPosition.xz * uSharedNoiseScale + noiseOffset;
    vec2 noiseUvXY = undeformedPosition.xy * uSharedNoiseScale + noiseOffset.yx;
    float noiseXZ = texture2D(uNoiseTex, noiseUvXZ).r;
    float noiseXY = texture2D(uNoiseTex, noiseUvXY).r;
    float sharedNoise = mix(noiseXZ, noiseXY, 0.35);

    vec3 localPosition = undeformedPosition;
    localPosition += blendedNormal * ((sharedNoise - 0.5) * uDisplacement * scaleCurve);
    localPosition += radialNormal * uOutlineThickness * appear;

    vNoiseUvXZ = noiseUvXZ;
    vNoiseUvXY = noiseUvXY;
    vLife = age;
    vParticleAge = particleAge;
    vSharedNoise = sharedNoise;

    #ifdef USE_INSTANCING
      vec4 worldPosition = modelMatrix * instanceMatrix * vec4(localPosition, 1.0);
      vWorldNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * blendedNormal);
    #else
      vec4 worldPosition = modelMatrix * vec4(localPosition, 1.0);
      vWorldNormal = normalize(mat3(modelMatrix) * blendedNormal);
    #endif
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const cloudFragmentShader = `
  uniform sampler2D uNoiseTex;
  uniform sampler2D uDetailTex;
  uniform sampler2D uDissolveTex;
  uniform vec3 uFireCoreColor;
  uniform vec3 uFireGlowColor;
  uniform vec3 uFireShadowColor;
  uniform vec3 uSmokeCoreColor;
  uniform vec3 uSmokeGlowColor;
  uniform vec3 uSmokeShadowColor;
  uniform vec3 uLightDirection;
  uniform float uNoiseLightingStrength;
  uniform float uShadowThreshold;
  uniform float uCoreThreshold;
  uniform float uEmissionPeak;

  varying vec2 vNoiseUvXZ;
  varying vec2 vNoiseUvXY;
  varying float vLife;
  varying float vParticleAge;
  varying float vSharedNoise;
  varying vec3 vWorldNormal;

  void main() {
    float detailXZ = texture2D(uDetailTex, vNoiseUvXZ * 1.35).r;
    float detailXY = texture2D(uDetailTex, vNoiseUvXY * 1.35).r;
    float detail = mix(detailXZ, detailXY, 0.35);
    float dissolveXZ = texture2D(uDissolveTex, vNoiseUvXZ * 0.9).r;
    float dissolveXY = texture2D(uDissolveTex, vNoiseUvXY * 0.9).r;
    float dissolve = mix(dissolveXZ, dissolveXY, 0.35);
    float surfaceNoise = vSharedNoise * 0.68 + detail * 0.32;
    float dissolveField = dissolve * 0.58 + surfaceNoise * 0.42;
    float dissolveProgress = smoothstep(0.62, 1.0, vLife);
    float dissolveThreshold = mix(-0.14, 0.72, dissolveProgress);
    if (vLife >= 0.999 || dissolveField < dissolveThreshold) {
      discard;
    }

    float smokeMix = smoothstep(0.3, 0.8, vParticleAge);
    float diffuse = dot(normalize(vWorldNormal), normalize(uLightDirection)) * 0.8 + 0.5;
    float celValue = diffuse * 0.25 + surfaceNoise * uNoiseLightingStrength;
    float glowBand = step(uShadowThreshold, celValue);
    float coreBand = step(uCoreThreshold, celValue);

    vec3 coreColor = mix(uFireCoreColor, uSmokeCoreColor, smokeMix);
    vec3 glowColor = mix(uFireGlowColor, uSmokeGlowColor, smokeMix);
    vec3 shadowColor = mix(uFireShadowColor, uSmokeShadowColor, smokeMix);
    vec3 color = mix(shadowColor, glowColor, glowBand);
    color = mix(color, coreColor, coreBand);

    float fireIntensity = 1.0 + (1.0 - smoothstep(0.0, 0.3, vParticleAge)) * uEmissionPeak * 0.32;
    color *= mix(fireIntensity, 1.0, smokeMix);
    gl_FragColor = vec4(color, 1.0);
  }
`;

const cloudOutlineFragmentShader = `
  uniform sampler2D uDetailTex;
  uniform sampler2D uDissolveTex;
  uniform vec3 uOutlineColor;

  varying vec2 vNoiseUvXZ;
  varying vec2 vNoiseUvXY;
  varying float vLife;
  varying float vSharedNoise;

  void main() {
    float detailXZ = texture2D(uDetailTex, vNoiseUvXZ * 1.35).r;
    float detailXY = texture2D(uDetailTex, vNoiseUvXY * 1.35).r;
    float detail = mix(detailXZ, detailXY, 0.35);
    float dissolveXZ = texture2D(uDissolveTex, vNoiseUvXZ * 0.9).r;
    float dissolveXY = texture2D(uDissolveTex, vNoiseUvXY * 0.9).r;
    float dissolve = mix(dissolveXZ, dissolveXY, 0.35);
    float surfaceNoise = vSharedNoise * 0.68 + detail * 0.32;
    float dissolveField = dissolve * 0.58 + surfaceNoise * 0.42;
    float dissolveProgress = smoothstep(0.62, 1.0, vLife);
    float dissolveThreshold = mix(-0.14, 0.72, dissolveProgress);
    if (vLife >= 0.999 || dissolveField < dissolveThreshold) {
      discard;
    }

    gl_FragColor = vec4(uOutlineColor, 1.0);
  }
`;

const streakVertexShader = `
  uniform float uAge;
  uniform float uStreakLifetime;
  uniform float uStreakLength;
  uniform float uStreakSpeed;
  uniform vec3 uCameraRight;
  uniform vec3 uCameraUp;

  attribute vec3 instanceDirection;
  attribute float instanceSeed;
  attribute vec2 instanceSize;
  attribute float instanceDelay;
  attribute float instanceSpeed;
  attribute float instanceTexture;

  varying vec2 vUv;
  varying float vLife;
  varying float vTextureIndex;

  void main() {
    float age = clamp((uAge - instanceDelay) / max(uStreakLifetime, 0.001), 0.0, 1.0);
    float grow = smoothstep(0.0, 0.18, age) * (1.0 - smoothstep(0.62, 1.0, age));
    vec3 forward = normalize(instanceDirection);
    vec3 right = normalize(cross(forward, normalize(cameraPosition)));
    if (length(right) < 0.05) {
      right = normalize(uCameraRight);
    }
    vec3 basePosition = forward * ((1.0 - exp(-age * 5.0)) * uStreakSpeed * instanceSpeed);
    vec3 localPosition = right * position.x * instanceSize.x * (0.65 + grow) + forward * position.y * instanceSize.y * uStreakLength * grow;
    localPosition += basePosition;
    localPosition.y += age * 0.18;

    vUv = uv;
    vLife = age;
    vTextureIndex = instanceTexture;

    #ifdef USE_INSTANCING
      vec4 worldPosition = modelMatrix * instanceMatrix * vec4(localPosition, 1.0);
    #else
      vec4 worldPosition = modelMatrix * vec4(localPosition, 1.0);
    #endif
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const streakFragmentShader = `
  uniform sampler2D uTextures[3];
  uniform vec3 uStreakColor;

  varying vec2 vUv;
  varying float vLife;
  varying float vTextureIndex;

  void main() {
    vec4 sampleColor;
    if (vTextureIndex < 0.5) {
      sampleColor = texture2D(uTextures[0], vUv);
    } else if (vTextureIndex < 1.5) {
      sampleColor = texture2D(uTextures[1], vUv);
    } else {
      sampleColor = texture2D(uTextures[2], vUv);
    }
    float fade = (1.0 - smoothstep(0.62, 1.0, vLife)) * smoothstep(0.0, 0.08, vLife);
    float alpha = sampleColor.a * max(max(sampleColor.r, sampleColor.g), sampleColor.b) * fade;
    if (alpha < 0.02) {
      discard;
    }
    gl_FragColor = vec4(uStreakColor * (1.4 + alpha * 2.2), alpha);
  }
`;

const flareVertexShader = `
  uniform float uAge;
  uniform float uDuration;
  uniform float uScale;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    float life = clamp(uAge / max(uDuration, 0.001), 0.0, 1.0);
    float scale = uScale * mix(1.0, 0.18, smoothstep(0.0, 1.0, life));
    vec3 localPosition = position * scale;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(localPosition, 1.0);
  }
`;

const flareFragmentShader = `
  uniform float uAge;
  uniform float uDuration;
  uniform sampler2D uTexture;
  uniform vec3 uColor;
  varying vec2 vUv;

  void main() {
    float life = clamp(uAge / max(uDuration, 0.001), 0.0, 1.0);
    vec4 texel = texture2D(uTexture, vUv);
    float alpha = texel.a * max(max(texel.r, texel.g), texel.b) * (1.0 - smoothstep(0.0, 1.0, life));
    if (alpha < 0.02) {
      discard;
    }
    gl_FragColor = vec4(uColor * (2.0 + alpha * 3.0), alpha);
  }
`;

const cracksVertexShader = `
  uniform float uScale;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec3 localPosition = position * uScale;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(localPosition, 1.0);
  }
`;

const cracksFragmentShader = `
  uniform float uAge;
  uniform float uDuration;
  uniform sampler2D uTexture;
  uniform vec3 uColor;
  varying vec2 vUv;

  void main() {
    vec4 texel = texture2D(uTexture, vUv);
    float life = clamp(uAge / max(uDuration, 0.001), 0.0, 1.0);
    float alpha = max(max(texel.r, texel.g), texel.b) * (1.0 - smoothstep(0.25, 1.0, life));
    if (alpha < 0.02) {
      discard;
    }
    gl_FragColor = vec4(uColor * (0.9 + (1.0 - life) * 1.8), alpha * 0.65);
  }
`;
