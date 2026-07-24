import * as THREE from "three";

export type AuraVfx2Options = {
  assetBaseUrl?: string | URL;
  baseColor?: THREE.ColorRepresentation;
};

const DEFAULT_ASSET_BASE_URL = "assets/vfx/goku-aura/";
const AURA_MASK_FILE = "T_aura_Polar-to-Rectangular.webp";
const NOISE_A_FILE = "T_PerlinNoise_Tiled.webp";
const NOISE_B_FILE = "T_CloudNoise_Tiled.webp";
const RING_POOL_SIZE = 4;
const RING_LIFETIME = 0.3;
const SPARK_COUNT = 48;

const depthFadeShaderChunk = `
  uniform sampler2D u_sceneDepth;
  uniform vec2 u_depthResolution;
  uniform float u_cameraNear;
  uniform float u_cameraFar;
  uniform float u_hasSceneDepth;

  float perspectiveDepthToViewZ(float depth) {
    return (u_cameraNear * u_cameraFar) /
      ((u_cameraFar - u_cameraNear) * depth - u_cameraFar);
  }

  float getSoftDepthFade() {
    if (u_hasSceneDepth < 0.5) {
      return 1.0;
    }

    vec2 screenUv = gl_FragCoord.xy / max(u_depthResolution, vec2(1.0));
    float sceneDepth = texture2D(u_sceneDepth, screenUv).x;
    float sceneDistance = -perspectiveDepthToViewZ(sceneDepth);
    float fragmentDistance = -perspectiveDepthToViewZ(gl_FragCoord.z);
    return smoothstep(0.0, 0.22, sceneDistance - fragmentDistance);
  }
`;

const auraVertexShader = `
  uniform float u_time;
  uniform float u_motionScale;

  varying vec2 vUv;
  varying float vRim;
  varying float vWave;

  void main() {
    vUv = uv;
    float waveTime = u_time * u_motionScale;
    float angle = uv.x * 6.28318;
    float largeWave = sin(angle * 7.0 - waveTime * 13.0);
    float detailWave = sin(angle * 13.0 + waveTime * 19.0) * 0.42;
    float travellingWave = sin(angle * 11.0 + uv.y * 19.0 - waveTime * 21.0);
    float spikeWave = pow(max(0.0, largeWave), 7.0);
    float heightStrength = mix(0.07, 0.2, pow(uv.y, 1.45));

    vec3 transformed = position;
    vec2 radialDirection = position.xz / max(length(position.xz), 0.0001);
    float radialOffset = (largeWave * 0.35 + detailWave) * heightStrength;
    radialOffset += travellingWave * mix(0.045, 0.13, uv.y);
    radialOffset += spikeWave * mix(0.035, 0.16, uv.y);
    transformed.xz += radialDirection * radialOffset;

    vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
    vec3 viewNormal = normalize(normalMatrix * normal);
    vec3 viewDirection = normalize(-viewPosition.xyz);
    vRim = pow(1.0 - abs(dot(viewNormal, viewDirection)), 1.35);
    vWave = largeWave * 0.5 + detailWave;
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const auraFragmentShader = `
  uniform sampler2D u_mask;
  uniform sampler2D u_noiseA;
  uniform sampler2D u_noiseB;
  uniform vec3 u_baseColor;
  uniform float u_time;
  uniform float u_activation;
  uniform float u_emission;
  uniform float u_motionScale;

  varying vec2 vUv;
  varying float vRim;
  varying float vWave;

  ${depthFadeShaderChunk}

  void main() {
    float waveTime = u_time * u_motionScale;
    vec2 noiseUvA = vec2(vUv.x * 5.0 + waveTime * 0.48, vUv.y * 7.0 - waveTime * 3.1);
    vec2 noiseUvB = vec2(vUv.x * 9.0 - waveTime * 0.72, vUv.y * 12.0 - waveTime * 4.6);
    float noiseA = texture2D(u_noiseA, noiseUvA).r;
    float noiseB = texture2D(u_noiseB, noiseUvB).r;
    float edgeNoise = noiseA * 0.64 + noiseB * 0.36 - 0.5;

    // Cylinder UV.x is already the angle around the spinner. The mask's horizontal
    // coordinate becomes shell height, turning its bright boundary into a jagged top.
    vec2 shellUV = vec2(
      clamp(vUv.y * 0.78 + edgeNoise * 0.11 - vWave * 0.035, 0.0, 0.995),
      fract(vUv.x - waveTime * 1.45 + edgeNoise * 0.1)
    );
    float maskValue = texture2D(u_mask, shellUV).r;
    float maskBlur = texture2D(u_mask, vec2(max(0.0, shellUV.x - 0.04), shellUV.y)).r;

    float flameBody = smoothstep(0.1, 0.51, maskValue);
    float brightContour = smoothstep(0.56, 0.9, max(maskValue, maskBlur * 0.92));
    float contourBreakup = smoothstep(0.28, 0.76, noiseB + noiseA * 0.18);
    brightContour *= mix(0.22, 1.0, contourBreakup);

    float upwardStreak = pow(smoothstep(0.48, 0.88, noiseA * 0.72 + noiseB * 0.46), 2.0);
    float bodyBreakup = smoothstep(0.24, 0.74, noiseA * 0.58 + noiseB * 0.42);
    float heightFade = smoothstep(0.0, 0.09, vUv.y);
    float topHaze = smoothstep(0.48, 0.92, maskBlur) * (1.0 - flameBody);
    float rimEnergy = vRim * mix(0.28, 1.0, contourBreakup);
    float alpha = flameBody * (0.1 + bodyBreakup * 0.17 + upwardStreak * 0.16);
    alpha += brightContour * 0.72 + topHaze * 0.2 + rimEnergy * flameBody * 0.055;
    alpha *= heightFade;
    alpha *= u_activation * getSoftDepthFade();

    if (alpha < 0.002) {
      discard;
    }

    float flicker = mix(0.86, 1.14, texture2D(u_noiseA, noiseUvA * 0.61).r);
    float edgeLight = max(brightContour, max(upwardStreak * 0.58, rimEnergy * 0.35));
    float brightness = mix(0.86, u_emission, edgeLight) * flicker;
    gl_FragColor = vec4(u_baseColor * brightness, alpha);
  }
`;

const ringVertexShader = `
  uniform float u_time;
  uniform float u_activation;

  attribute float a_birthTime;
  attribute float a_seed;

  varying vec2 vUv;
  varying float vLife;
  varying float vSeed;

  void main() {
    float age = u_time - a_birthTime;
    float normalizedAge = age / ${RING_LIFETIME.toFixed(2)};
    float alive = step(0.0, age) * (1.0 - step(1.0, normalizedAge));
    float growth = mix(0.42, 1.0, smoothstep(0.0, 1.0, normalizedAge));
    vec3 transformed = position;
    transformed.xy *= growth;

    vUv = uv;
    vLife = alive * (1.0 - smoothstep(0.42, 1.0, normalizedAge)) * u_activation;
    vSeed = a_seed;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(transformed, 1.0);
  }
`;

const ringFragmentShader = `
  uniform vec3 u_baseColor;

  varying vec2 vUv;
  varying float vLife;
  varying float vSeed;

  ${depthFadeShaderChunk}

  void main() {
    vec2 centered = vUv - 0.5;
    float radius = length(centered);
    float angle = atan(centered.y, centered.x);
    float irregularity = sin(angle * 7.0 + vSeed * 19.0) * 0.012;
    float ring = 1.0 - smoothstep(0.018, 0.052, abs(radius - 0.38 - irregularity));
    float brokenArc = smoothstep(0.18, 0.75, sin(angle * 3.0 + vSeed * 31.0) * 0.5 + 0.5);
    float alpha = ring * mix(0.42, 1.0, brokenArc) * vLife * getSoftDepthFade();

    if (alpha < 0.002) {
      discard;
    }

    gl_FragColor = vec4(u_baseColor * 1.8, alpha * 0.23);
  }
`;

const sparkVertexShader = `
  uniform float u_time;
  uniform float u_activation;
  uniform float u_motionScale;
  uniform float u_visibleSparkCount;

  attribute vec4 a_sparkParams;
  attribute float a_sparkIndex;

  varying vec2 vUv;
  varying float vLife;

  void main() {
    float angle = a_sparkParams.x;
    float radius = a_sparkParams.y;
    float speed = a_sparkParams.z;
    float phase = a_sparkParams.w;
    float lifetime = mix(0.72, 1.28, fract(phase * 7.31));
    float cycle = fract((u_time * max(u_motionScale, 0.08)) / lifetime + phase);
    float enabled = 1.0 - step(u_visibleSparkCount, a_sparkIndex);
    float fade = (1.0 - smoothstep(0.48, 1.0, cycle)) * enabled * u_activation;

    float drift = sin(u_time * 2.2 + phase * 23.0) * 0.08 * u_motionScale;
    vec3 localPosition = vec3(
      cos(angle) * (radius + drift),
      0.08 + cycle * speed,
      sin(angle) * (radius - drift)
    );
    vec4 viewCenter = modelViewMatrix * vec4(localPosition, 1.0);
    float size = mix(0.09, 0.018, cycle);
    viewCenter.xy += position.xy * size;

    vUv = uv;
    vLife = fade;
    gl_Position = projectionMatrix * viewCenter;
  }
`;

const sparkFragmentShader = `
  uniform vec3 u_baseColor;

  varying vec2 vUv;
  varying float vLife;

  ${depthFadeShaderChunk}

  void main() {
    vec2 centered = vUv - 0.5;
    float shape = 1.0 - smoothstep(0.16, 0.5, length(centered));
    float alpha = shape * vLife * getSoftDepthFade();
    if (alpha < 0.002) {
      discard;
    }
    gl_FragColor = vec4(u_baseColor * 2.8, alpha);
  }
`;

export class AuraVfx2 {
  readonly group = new THREE.Group();
  readonly ready: Promise<void>;

  private readonly baseColor: THREE.Color;
  private readonly auraMaterial: THREE.ShaderMaterial;
  private readonly ringMaterial: THREE.ShaderMaterial;
  private readonly sparkMaterial: THREE.ShaderMaterial;
  private readonly auraGeometry: THREE.CylinderGeometry;
  private readonly auraMesh: THREE.Mesh<THREE.CylinderGeometry, THREE.ShaderMaterial>;
  private readonly ringMesh: THREE.InstancedMesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private readonly sparkMesh: THREE.InstancedMesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private readonly ringBirthTimes: THREE.InstancedBufferAttribute;
  private readonly ringSeeds: THREE.InstancedBufferAttribute;
  private readonly ownedTextures: THREE.Texture[] = [];
  private readonly ringMatrix = new THREE.Matrix4();
  private readonly ringQuaternion = new THREE.Quaternion();
  private readonly ringPosition = new THREE.Vector3();
  private readonly ringScale = new THREE.Vector3(1, 1, 1);
  private readonly ringAxis = new THREE.Vector3(0, 0, 1);
  private desiredActive = false;
  private activation = 0;
  private resourcesReady = false;
  private disposed = false;
  private ringCursor = 0;
  private ringTimer = 0;
  private nextRingDelay = 1 / 5.5;

  constructor(options: AuraVfx2Options = {}) {
    this.group.name = "AuraVFX_2";
    this.group.visible = false;
    this.baseColor = new THREE.Color(options.baseColor ?? "#ffd23f");

    const maskPlaceholder = createPlaceholderTexture(255);
    const noiseAPlaceholder = createPlaceholderTexture(128);
    const noiseBPlaceholder = createPlaceholderTexture(160);
    this.ownedTextures.push(maskPlaceholder, noiseAPlaceholder, noiseBPlaceholder);

    this.auraMaterial = createAuraMaterial(
      this.baseColor,
      maskPlaceholder,
      noiseAPlaceholder,
      noiseBPlaceholder,
    );
    this.auraGeometry = new THREE.CylinderGeometry(1.15, 1.55, 1.25, 96, 16, true);
    this.auraMesh = new THREE.Mesh(this.auraGeometry, this.auraMaterial);
    this.auraMesh.name = "AuraVFX_2 Vertical Shell";
    this.auraMesh.position.y = 0.625;
    this.auraMesh.renderOrder = 12;
    this.auraMesh.frustumCulled = false;
    this.group.add(this.auraMesh);

    const ringGeometry = new THREE.PlaneGeometry(7, 7);
    this.ringBirthTimes = new THREE.InstancedBufferAttribute(new Float32Array(RING_POOL_SIZE), 1);
    this.ringSeeds = new THREE.InstancedBufferAttribute(new Float32Array(RING_POOL_SIZE), 1);
    ringGeometry.setAttribute("a_birthTime", this.ringBirthTimes);
    ringGeometry.setAttribute("a_seed", this.ringSeeds);
    this.ringMaterial = createRingMaterial(this.baseColor, maskPlaceholder);
    this.ringMesh = new THREE.InstancedMesh(ringGeometry, this.ringMaterial, RING_POOL_SIZE);
    this.ringMesh.name = "AuraVFX_2 Ground Rings";
    this.ringMesh.rotation.x = -Math.PI / 2;
    this.ringMesh.position.y = 0.035;
    this.ringMesh.renderOrder = 11;
    this.ringMesh.frustumCulled = false;
    this.ringMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let index = 0; index < RING_POOL_SIZE; index += 1) {
      this.ringBirthTimes.setX(index, -1000);
      this.ringSeeds.setX(index, index / RING_POOL_SIZE);
      this.ringMesh.setMatrixAt(index, this.ringMatrix.identity());
    }
    this.ringBirthTimes.needsUpdate = true;
    this.ringSeeds.needsUpdate = true;
    this.ringMesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.ringMesh);

    const sparkGeometry = createSparkGeometry();
    this.sparkMaterial = createSparkMaterial(this.baseColor, maskPlaceholder);
    this.sparkMesh = new THREE.InstancedMesh(sparkGeometry, this.sparkMaterial, SPARK_COUNT);
    this.sparkMesh.name = "AuraVFX_2 Sparks";
    this.sparkMesh.renderOrder = 13;
    this.sparkMesh.frustumCulled = false;
    this.group.add(this.sparkMesh);

    const assetBaseUrl = new URL(
      options.assetBaseUrl ?? DEFAULT_ASSET_BASE_URL,
      document.baseURI,
    );
    this.ready = this.loadTextures(assetBaseUrl);
  }

  get active(): boolean {
    return this.desiredActive;
  }

  start(color?: THREE.ColorRepresentation): void {
    if (color !== undefined) {
      this.setColor(color);
    }
    this.desiredActive = true;
    this.ringTimer = this.nextRingDelay;
  }

  stop(): void {
    this.desiredActive = false;
  }

  setActiveImmediately(active: boolean): void {
    this.desiredActive = active;
    this.activation = active ? 1 : 0;
    this.group.visible = active && this.resourcesReady;
    this.auraMaterial.uniforms.u_activation.value = this.activation;
    this.ringMaterial.uniforms.u_activation.value = this.activation;
    this.sparkMaterial.uniforms.u_activation.value = this.activation;
    if (active) return;
    this.ringCursor = 0;
    this.ringTimer = 0;
    for (let index = 0; index < RING_POOL_SIZE; index += 1) {
      this.ringBirthTimes.setX(index, -1000);
    }
    this.ringBirthTimes.needsUpdate = true;
  }

  setColor(color: THREE.ColorRepresentation): void {
    this.baseColor.set(color);
  }

  setDepthContext(
    texture: THREE.Texture,
    resolution: THREE.Vector2,
    cameraNear: number,
    cameraFar: number,
  ): void {
    for (const material of [this.auraMaterial, this.ringMaterial, this.sparkMaterial]) {
      material.uniforms.u_sceneDepth.value = texture;
      material.uniforms.u_depthResolution.value.copy(resolution);
      material.uniforms.u_cameraNear.value = cameraNear;
      material.uniforms.u_cameraFar.value = cameraFar;
      material.uniforms.u_hasSceneDepth.value = 1;
    }
  }

  update(
    deltaTime: number,
    elapsedTime: number,
    camera: THREE.Camera,
    reducedMotion = false,
  ): void {
    if (this.disposed) {
      return;
    }

    const targetActivation = this.desiredActive ? 1 : 0;
    const fadeSpeed = this.desiredActive ? 4.5 : 3.4;
    this.activation = moveTowards(this.activation, targetActivation, deltaTime * fadeSpeed);
    this.group.visible = this.resourcesReady && this.activation > 0.001;
    if (camera instanceof THREE.PerspectiveCamera) {
      this.auraMaterial.uniforms.u_cameraNear.value = camera.near;
      this.auraMaterial.uniforms.u_cameraFar.value = camera.far;
      this.ringMaterial.uniforms.u_cameraNear.value = camera.near;
      this.ringMaterial.uniforms.u_cameraFar.value = camera.far;
      this.sparkMaterial.uniforms.u_cameraNear.value = camera.near;
      this.sparkMaterial.uniforms.u_cameraFar.value = camera.far;
    }

    const motionScale = reducedMotion ? 0.12 : 1;
    this.auraMaterial.uniforms.u_time.value = elapsedTime;
    this.auraMaterial.uniforms.u_activation.value = this.activation;
    this.auraMaterial.uniforms.u_motionScale.value = motionScale;
    this.ringMaterial.uniforms.u_time.value = elapsedTime;
    this.ringMaterial.uniforms.u_activation.value = reducedMotion ? 0 : this.activation;
    this.sparkMaterial.uniforms.u_time.value = elapsedTime;
    this.sparkMaterial.uniforms.u_activation.value = this.activation;
    this.sparkMaterial.uniforms.u_motionScale.value = motionScale;
    this.sparkMaterial.uniforms.u_visibleSparkCount.value = reducedMotion ? 10 : SPARK_COUNT;

    if (this.desiredActive && this.resourcesReady && !reducedMotion) {
      this.ringTimer += deltaTime;
      while (this.ringTimer >= this.nextRingDelay) {
        this.ringTimer -= this.nextRingDelay;
        this.spawnRing(elapsedTime);
        this.nextRingDelay = 1 / THREE.MathUtils.lerp(5, 6, Math.random());
      }
    }
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.group.remove(this.auraMesh, this.ringMesh, this.sparkMesh);
    this.auraGeometry.dispose();
    this.ringMesh.geometry.dispose();
    this.sparkMesh.geometry.dispose();
    this.auraMaterial.dispose();
    this.ringMaterial.dispose();
    this.sparkMaterial.dispose();
    for (const texture of this.ownedTextures) {
      texture.dispose();
    }
    this.ownedTextures.length = 0;
  }

  private async loadTextures(assetBaseUrl: URL): Promise<void> {
    const loader = new THREE.TextureLoader();
    const loadedTextures = await Promise.all([
      loader.loadAsync(new URL(AURA_MASK_FILE, assetBaseUrl).href),
      loader.loadAsync(new URL(NOISE_A_FILE, assetBaseUrl).href),
      loader.loadAsync(new URL(NOISE_B_FILE, assetBaseUrl).href),
    ]);
    const [mask, noiseA, noiseB] = loadedTextures;
    configureMaskTexture(mask);
    configureNoiseTexture(noiseA);
    configureNoiseTexture(noiseB);

    if (this.disposed) {
      for (const texture of loadedTextures) {
        texture.dispose();
      }
      return;
    }

    for (const texture of this.ownedTextures) {
      texture.dispose();
    }
    this.ownedTextures.length = 0;
    this.ownedTextures.push(mask, noiseA, noiseB);
    this.auraMaterial.uniforms.u_mask.value = mask;
    this.auraMaterial.uniforms.u_noiseA.value = noiseA;
    this.auraMaterial.uniforms.u_noiseB.value = noiseB;
    this.resourcesReady = true;
  }

  private spawnRing(elapsedTime: number): void {
    const index = this.ringCursor;
    const seed = Math.random();
    this.ringBirthTimes.setX(index, elapsedTime);
    this.ringSeeds.setX(index, seed);
    this.ringQuaternion.setFromAxisAngle(this.ringAxis, seed * Math.PI * 2);
    this.ringMatrix.compose(this.ringPosition, this.ringQuaternion, this.ringScale);
    this.ringMesh.setMatrixAt(index, this.ringMatrix);
    this.ringBirthTimes.needsUpdate = true;
    this.ringSeeds.needsUpdate = true;
    this.ringMesh.instanceMatrix.needsUpdate = true;
    this.ringCursor = (index + 1) % RING_POOL_SIZE;
  }

}

function createAuraMaterial(
  color: THREE.Color,
  mask: THREE.Texture,
  noiseA: THREE.Texture,
  noiseB: THREE.Texture,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      u_mask: { value: mask },
      u_noiseA: { value: noiseA },
      u_noiseB: { value: noiseB },
      u_baseColor: { value: color },
      u_time: { value: 0 },
      u_activation: { value: 0 },
      u_emission: { value: 3 },
      u_motionScale: { value: 1 },
      ...createDepthUniforms(mask),
    },
    vertexShader: auraVertexShader,
    fragmentShader: auraFragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

function createRingMaterial(color: THREE.Color, depthPlaceholder: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      u_baseColor: { value: color },
      u_time: { value: 0 },
      u_activation: { value: 0 },
      ...createDepthUniforms(depthPlaceholder),
    },
    vertexShader: ringVertexShader,
    fragmentShader: ringFragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

function createSparkMaterial(color: THREE.Color, depthPlaceholder: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      u_baseColor: { value: color },
      u_time: { value: 0 },
      u_activation: { value: 0 },
      u_motionScale: { value: 1 },
      u_visibleSparkCount: { value: SPARK_COUNT },
      ...createDepthUniforms(depthPlaceholder),
    },
    vertexShader: sparkVertexShader,
    fragmentShader: sparkFragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

function createDepthUniforms(depthPlaceholder: THREE.Texture): Record<string, THREE.IUniform> {
  return {
    u_sceneDepth: { value: depthPlaceholder },
    u_depthResolution: { value: new THREE.Vector2(1, 1) },
    u_cameraNear: { value: 0.1 },
    u_cameraFar: { value: 100 },
    u_hasSceneDepth: { value: 0 },
  };
}

function createSparkGeometry(): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(1, 1);
  const params = new Float32Array(SPARK_COUNT * 4);
  const indices = new Float32Array(SPARK_COUNT);
  for (let index = 0; index < SPARK_COUNT; index += 1) {
    const offset = index * 4;
    params[offset] = Math.random() * Math.PI * 2;
    params[offset + 1] = THREE.MathUtils.lerp(0.18, 0.82, Math.random());
    params[offset + 2] = THREE.MathUtils.lerp(1.15, 3.1, Math.random());
    params[offset + 3] = Math.random();
    indices[index] = index;
  }
  geometry.setAttribute("a_sparkParams", new THREE.InstancedBufferAttribute(params, 4));
  geometry.setAttribute("a_sparkIndex", new THREE.InstancedBufferAttribute(indices, 1));
  return geometry;
}

function createPlaceholderTexture(value: number): THREE.DataTexture {
  const data = new Uint8Array([value, value, value, 255]);
  const texture = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function configureMaskTexture(texture: THREE.Texture): void {
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
}

function configureNoiseTexture(texture: THREE.Texture): void {
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
}

function moveTowards(current: number, target: number, maxDelta: number): number {
  if (Math.abs(target - current) <= maxDelta) {
    return target;
  }
  return current + Math.sign(target - current) * maxDelta;
}
