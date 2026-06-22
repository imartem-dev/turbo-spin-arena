import * as THREE from "three";

export type TornadoVfxPart = "tornado" | "shockwave" | "gust" | "dust" | "debris" | "arcs";

export const tornadoVfxParts: TornadoVfxPart[] = ["tornado", "shockwave", "gust", "dust", "debris", "arcs"];

export type TornadoVfxLayerConfig = {
  blendMode: "additive" | "normal" | "multiply";
  color: string;
  accentColor: string;
  rimColor: string;
  height: number;
  baseWidth: number;
  topWidth: number;
  twist: number;
  speed: number;
  opacity: number;
  noise: number;
  intensity: number;
  rimStrength: number;
  rimPower: number;
  streakDensity: number;
  streakSharpness: number;
  waveStrength: number;
  displaceStrength: number;
  edgeSoftness: number;
  debrisCount: number;
  debrisSize: number;
  orbitRandomness: number;
  pulseStrength: number;
  ringThickness: number;
  ringFrequency: number;
  ringWidth: number;
  edgeFade: number;
  arcCount: number;
  arcLength: number;
  jaggedness: number;
  branchCount: number;
  flickerRate: number;
  orbitDrift: number;
  thickness: number;
  glowStrength: number;
  arcSmoothness: number;
  arcFlashIn: number;
  arcHold: number;
  arcFlashOut: number;
  arcRest: number;
  sandPuffCount: number;
  sandParticleCount: number;
  sandRadius: number;
  sandHeight: number;
  sandSpread: number;
  sandLifetime: number;
  sandTurbulence: number;
  sandVoronoiScale: number;
  sandVoronoiStrength: number;
  sandSoftness: number;
  sandParticleSize: number;
};

export type TornadoVfxConfig = TornadoVfxLayerConfig;

export type TornadoVfxPreset = {
  version: number;
  enabled?: Partial<Record<string, boolean>>;
  layers?: Partial<Record<string, Partial<TornadoVfxLayerConfig>>>;
};

type DebrisState = {
  radius: number;
  speed: number;
  height: number;
  phase: number;
  size: number;
};

type ArcPath = THREE.Vector3[];

type ArcFrame = {
  coreGeometry: THREE.BufferGeometry;
  glowGeometry: THREE.BufferGeometry;
};

const defaultConfig: TornadoVfxLayerConfig = {
  blendMode: "additive",
  color: "#ffd94a",
  accentColor: "#fff4a8",
  rimColor: "#ffffff",
  height: 2.65,
  baseWidth: 0.24,
  topWidth: 1.16,
  twist: 8.4,
  speed: 1.4,
  opacity: 0.58,
  noise: 1.15,
  intensity: 1.15,
  rimStrength: 1.4,
  rimPower: 2.4,
  streakDensity: 18,
  streakSharpness: 4.4,
  waveStrength: 0.1,
  displaceStrength: 0.055,
  edgeSoftness: 0.38,
  debrisCount: 42,
  debrisSize: 1,
  orbitRandomness: 0.32,
  pulseStrength: 0.08,
  ringThickness: 0.055,
  ringFrequency: 8,
  ringWidth: 0.36,
  edgeFade: 0.22,
  arcCount: 16,
  arcLength: 0.32,
  jaggedness: 0.46,
  branchCount: 2,
  flickerRate: 12,
  orbitDrift: 0.35,
  thickness: 0.035,
  glowStrength: 1.25,
  arcSmoothness: 0.35,
  arcFlashIn: 0.08,
  arcHold: 0.18,
  arcFlashOut: 0.22,
  arcRest: 1.8,
  sandPuffCount: 34,
  sandParticleCount: 180,
  sandRadius: 1.5,
  sandHeight: 0.9,
  sandSpread: 1.15,
  sandLifetime: 2.4,
  sandTurbulence: 0.75,
  sandVoronoiScale: 6.5,
  sandVoronoiStrength: 0.55,
  sandSoftness: 0.42,
  sandParticleSize: 0.035,
};

const defaultLayerConfigs: Record<TornadoVfxPart, TornadoVfxLayerConfig> = {
  tornado: { ...defaultConfig },
  shockwave: {
    ...defaultConfig,
    height: 0.5,
    baseWidth: 0.12,
    topWidth: 1.35,
    twist: 8.0,
    ringFrequency: 12.0,
    ringWidth: 0.22,
    edgeFade: 0.28,
    speed: 1.35,
    opacity: 0.72,
    noise: 1.25,
    intensity: 1.55,
    rimStrength: 1.5,
    rimPower: 2.2,
    streakDensity: 22,
    streakSharpness: 6.0,
    waveStrength: 0.16,
    displaceStrength: 0.22,
  },
  gust: {
    ...defaultConfig,
    color: "#fff7c4",
    accentColor: "#ffffff",
    rimColor: "#ffffff",
    height: 2.35,
    baseWidth: 0.34,
    topWidth: 1.28,
    twist: 5.2,
    speed: 1.15,
    opacity: 0.38,
    noise: 1.35,
    streakDensity: 24,
    streakSharpness: 5.2,
    waveStrength: 0.08,
    displaceStrength: 0.035,
  },
  dust: {
    ...defaultConfig,
    color: "#f4c76a",
    accentColor: "#fff2a8",
    rimColor: "#ffffff",
    height: 0.08,
    baseWidth: 0.055,
    topWidth: 0.82,
    twist: 0,
    speed: 0.85,
    opacity: 0.32,
    noise: 0,
    pulseStrength: 0.08,
    ringThickness: 0.055,
  },
  debris: {
    ...defaultConfig,
    color: "#fff1b8",
    accentColor: "#ffffff",
    rimColor: "#ffffff",
    height: 2.4,
    baseWidth: 0.42,
    topWidth: 1.42,
    twist: 0,
    speed: 1.25,
    opacity: 0.82,
    noise: 0,
    debrisCount: 42,
    debrisSize: 1,
    orbitRandomness: 0.32,
  },
  arcs: {
    ...defaultConfig,
    color: "#ffd94a",
    accentColor: "#fff4a8",
    rimColor: "#ffffff",
    height: 1.25,
    baseWidth: 0.68,
    topWidth: 0.95,
    speed: 1.8,
    opacity: 0.92,
    arcCount: 16,
    arcLength: 0.32,
    jaggedness: 0.46,
    branchCount: 2,
    flickerRate: 12,
    orbitDrift: 0.35,
    thickness: 0.035,
    glowStrength: 1.25,
    arcSmoothness: 0.45,
    arcFlashIn: 0.08,
    arcHold: 0.18,
    arcFlashOut: 0.22,
    arcRest: 1.8,
  },
};

const tornadoVertexShader = `
  uniform float time;
  uniform float height;
  uniform float baseWidth;
  uniform float topWidth;
  uniform float twist;
  uniform float speed;
  uniform float waveStrength;
  uniform float displaceStrength;
  uniform float noiseStrength;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying float vWave;

  float hash(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 19.19);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  void main() {
    vUv = uv;
    float y = uv.y;
    vec3 pos = position;
    float angle = atan(pos.z, pos.x);
    float wave = sin(y * 22.0 - time * speed * 5.2 + angle * 2.0);
    float pulse = 1.0 + wave * waveStrength + sin(y * 7.0 + time * speed * 2.4) * waveStrength * 0.72;
    float waist = 1.0 - smoothstep(0.08, 0.55, y) * (1.0 - smoothstep(0.50, 1.0, y)) * 0.18;
    float roughness = (noise(vec2(angle * 3.2 + time * 0.22, y * 12.0 * max(noiseStrength, 0.1))) - 0.5) * 2.0;
    float radius = mix(baseWidth, topWidth, pow(y, 0.72)) * pulse * waist + roughness * displaceStrength;
    float spiral = twist * y + time * speed * 2.25 + sin(y * 10.0 + time * speed) * 0.35;
    float c = cos(spiral);
    float s = sin(spiral);

    pos.xz *= radius;
    pos.xz = mat2(c, -s, s, c) * pos.xz;
    pos.y = y * height;

    vWave = wave;
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const tornadoFragmentShader = `
  uniform float time;
  uniform vec3 color;
  uniform vec3 accentColor;
  uniform vec3 rimColor;
  uniform float opacity;
  uniform float noiseStrength;
  uniform float intensity;
  uniform float rimStrength;
  uniform float rimPower;
  uniform float streakDensity;
  uniform float streakSharpness;
  uniform float edgeSoftness;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying float vWave;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), max(rimPower, 0.01));
    float n = noise(vec2(vUv.x * 18.0 + time * 0.18, vUv.y * 8.0 - time * 0.45));
    float spiral = vUv.y * max(streakDensity, 0.01) + vUv.x * max(streakDensity, 0.01) * 0.72 - time * 1.8 * max(intensity, 0.01);
    float bands = sin(spiral + n * noiseStrength * 3.2);
    float streak = pow(smoothstep(1.0 - edgeSoftness, 1.0, bands * 0.5 + 0.5), max(streakSharpness, 0.01));
    float cells = smoothstep(0.22, 0.92, n + streak * 0.58);
    float verticalFade = smoothstep(0.0, 0.10 + edgeSoftness * 0.12, vUv.y) * (1.0 - smoothstep(0.92, 1.0, vUv.y) * edgeSoftness);
    float alpha = opacity * verticalFade * mix(0.08, 0.78, cells) * (0.34 + streak * 0.86 + fresnel * rimStrength + abs(vWave) * 0.12);
    vec3 rampColor = mix(color, accentColor, clamp(streak + n * 0.35, 0.0, 1.0));
    vec3 finalColor = rampColor * (0.72 + streak * intensity * 1.6) + rimColor * fresnel * rimStrength;
    gl_FragColor = vec4(finalColor, clamp(alpha, 0.0, 1.0));
  }
`;

const gustVertexShader = `
  uniform float time;
  uniform float height;
  uniform float baseWidth;
  uniform float topWidth;
  uniform float twist;
  uniform float speed;
  uniform float waveStrength;
  uniform float displaceStrength;

  varying vec2 vUv;
  varying vec3 vWorldPosition;

  void main() {
    vUv = uv;
    float y = uv.y;
    vec3 pos = position;
    float angle = atan(pos.z, pos.x);
    float updraft = sin(y * 16.0 - time * speed * 7.0) * waveStrength;
    float edgeFlutter = sin(angle * 5.0 + y * 14.0 - time * speed * 2.6) * displaceStrength;
    float radius = mix(baseWidth * 1.14, topWidth * 1.08, pow(y, 0.78)) + updraft + edgeFlutter;
    float spiral = twist * 0.55 * y + time * speed * 1.5;
    float c = cos(spiral);
    float s = sin(spiral);

    pos.xz *= radius;
    pos.xz = mat2(c, -s, s, c) * pos.xz;
    pos.y = y * height;

    vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const gustFragmentShader = `
  uniform float time;
  uniform vec3 color;
  uniform vec3 accentColor;
  uniform float opacity;
  uniform float noiseStrength;
  uniform float intensity;
  uniform float streakDensity;
  uniform float streakSharpness;
  uniform float edgeSoftness;

  varying vec2 vUv;

  float hash(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 19.19);
    return fract(p.x * p.y);
  }

  void main() {
    float movingY = fract(vUv.y - time * 0.45 * max(intensity, 0.01));
    float streak = sin((movingY * max(streakDensity, 0.01) + vUv.x * 10.0) * 3.14159);
    float n = hash(floor(vec2(vUv.x * 20.0, movingY * 16.0)));
    float alpha = pow(smoothstep(1.0 - edgeSoftness, 1.0, streak * 0.5 + 0.5 + n * noiseStrength * 0.2), max(streakSharpness, 0.01));
    alpha *= opacity * 0.42 * smoothstep(0.02, 0.22, vUv.y) * (1.0 - smoothstep(0.92, 1.0, vUv.y));
    gl_FragColor = vec4(mix(color, accentColor, 0.55 + alpha * 0.35), alpha);
  }
`;

const shockwaveVertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const shockwaveFragmentShader = `
  uniform float time;
  uniform vec3 color;
  uniform vec3 accentColor;
  uniform vec3 rimColor;
  uniform float opacity;
  uniform float speed;
  uniform float noiseStrength;
  uniform float intensity;
  uniform float rimStrength;
  uniform float rimPower;
  uniform float streakDensity;
  uniform float streakSharpness;
  uniform float waveStrength;
  uniform float displaceStrength;
  uniform float ringFrequency;
  uniform float ringWidth;
  uniform float edgeFade;

  varying vec2 vUv;

  float hash(float p) {
    return fract(sin(p * 127.1) * 43758.5453);
  }

  float angularNoise(float angle, float cells) {
    float sector = angle / 6.2831853 * cells;
    float base = floor(sector);
    float f = fract(sector);
    float a = hash(base);
    float b = hash(base + 1.0);
    float c = hash(base + 7.0);
    float smoothF = f * f * (3.0 - 2.0 * f);
    return mix(a, b, smoothF) * 0.72 + c * 0.28;
  }

  void main() {
    vec2 centered = vUv - 0.5;
    float distanceFromCenter = length(centered) * 2.0;
    float angle = atan(centered.y, centered.x) + 3.14159265;
    float cells = max(streakDensity, 1.0);
    float pulse = fract(time * max(speed, 0.01) * 0.34);
    float easedPulse = pulse * pulse * (3.0 - 2.0 * pulse);
    float waveRadius = mix(0.12, 0.96, easedPulse);
    float coarse = angularNoise(angle + time * 0.18, max(ringFrequency, 1.0));
    float fine = angularNoise(angle * 1.7 - time * 0.12, cells);
    float unevenRadius = (coarse - 0.5) * displaceStrength * 0.78 + (fine - 0.5) * noiseStrength * 0.10;
    float ripple = sin(angle * max(ringFrequency, 1.0) + time * speed * 2.0) * waveStrength;
    float targetRadius = clamp(waveRadius + unevenRadius + ripple, 0.06, 1.1);
    float width = max(ringWidth, 0.01) * mix(0.55, 1.15, fine);
    float ring = 1.0 - smoothstep(width * 0.55, width, abs(distanceFromCenter - targetRadius));

    float spokeSeed = angularNoise(angle, cells);
    float spokes = pow(smoothstep(0.58, 1.0, spokeSeed + fine * 0.38), max(streakSharpness, 0.01));
    float spokeFade = (1.0 - smoothstep(targetRadius * 0.18, targetRadius, distanceFromCenter)) * (1.0 - pulse);
    float jaggedInside = smoothstep(distanceFromCenter, distanceFromCenter + width * 0.9, targetRadius - unevenRadius * 0.35);
    float outerFade = 1.0 - smoothstep(max(1.0 - edgeFade, 0.01), 1.0, distanceFromCenter);
    float centerFade = smoothstep(0.025, max(edgeFade, 0.01), distanceFromCenter);
    float glow = ring * (0.58 + fine * 0.42) + spokes * spokeFade * 0.92;
    float alpha = glow * jaggedInside * centerFade * outerFade * opacity;

    vec3 ringColor = mix(color, accentColor, clamp(fine * 0.8 + spokes * 0.4, 0.0, 1.0));
    vec3 edgeColor = mix(ringColor, rimColor, pow(ring, max(rimPower, 0.01)) * rimStrength * 0.35);
    gl_FragColor = vec4(edgeColor * (0.65 + intensity * 0.7), clamp(alpha, 0.0, 1.0));
  }
`;

export class TornadoVfx {
  readonly group = new THREE.Group();

  private configs: Record<TornadoVfxPart, TornadoVfxLayerConfig>;
  private readonly enabled: Record<TornadoVfxPart, boolean> = {
    tornado: true,
    shockwave: true,
    gust: true,
    dust: true,
    debris: true,
    arcs: false,
  };
  private readonly tornadoMaterial: THREE.ShaderMaterial;
  private readonly gustMaterial: THREE.ShaderMaterial;
  private readonly shockwaveMaterial: THREE.ShaderMaterial;
  private readonly dustMaterial: THREE.ShaderMaterial;
  private readonly debrisMaterial: THREE.MeshBasicMaterial;
  private readonly arcCoreMaterial: THREE.MeshBasicMaterial;
  private readonly arcGlowMaterial: THREE.MeshBasicMaterial;
  private readonly tornadoMesh: THREE.Mesh;
  private readonly gustMesh: THREE.Mesh;
  private readonly shockwaveMesh: THREE.Mesh;
  private readonly dustMesh: THREE.Mesh;
  private readonly debrisMesh: THREE.InstancedMesh;
  private readonly arcCoreMesh: THREE.Mesh;
  private readonly arcGlowMesh: THREE.Mesh;
  private debrisStates: DebrisState[] = [];
  private arcFrames: ArcFrame[] = [];
  private arcCycleTime = 0;
  private arcCycleDuration = 1;
  private arcFrameIndex = -1;
  private readonly debrisMatrix = new THREE.Matrix4();
  private readonly debrisQuaternion = new THREE.Quaternion();
  private readonly debrisScale = new THREE.Vector3();
  private readonly debrisPosition = new THREE.Vector3();

  constructor(preset?: TornadoVfxPreset) {
    this.configs = cloneLayerConfigs();
    if (preset) {
      this.mergePreset(preset);
    }
    this.group.name = "TornadoVfx";

    const tornadoGeometry = new THREE.CylinderGeometry(1, 1, 1, 64, 48, true);
    tornadoGeometry.translate(0, 0.5, 0);

    this.tornadoMaterial = createTornadoMaterial(this.configs.tornado);
    this.tornadoMesh = new THREE.Mesh(tornadoGeometry, this.tornadoMaterial);
    this.tornadoMesh.renderOrder = 6;
    this.tornadoMesh.frustumCulled = false;
    this.group.add(this.tornadoMesh);

    this.gustMaterial = createGustMaterial(this.configs.gust);
    this.gustMesh = new THREE.Mesh(tornadoGeometry.clone(), this.gustMaterial);
    this.gustMesh.renderOrder = 5;
    this.gustMesh.frustumCulled = false;
    this.group.add(this.gustMesh);

    this.shockwaveMaterial = createShockwaveMaterial(this.configs.shockwave);
    this.shockwaveMesh = new THREE.Mesh(new THREE.CircleGeometry(1.45, 64), this.shockwaveMaterial);
    this.shockwaveMesh.rotation.x = -Math.PI / 2;
    this.shockwaveMesh.position.y = 0.035;
    this.shockwaveMesh.renderOrder = 4;
    this.group.add(this.shockwaveMesh);

    this.dustMaterial = createGustMaterial(this.configs.dust);
    this.dustMesh = new THREE.Mesh(tornadoGeometry.clone(), this.dustMaterial);
    this.dustMesh.renderOrder = 3;
    this.dustMesh.frustumCulled = false;
    this.group.add(this.dustMesh);

    this.debrisMaterial = new THREE.MeshBasicMaterial({
      color: this.configs.debris.color,
      transparent: true,
      opacity: this.configs.debris.opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.debrisMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.045, 0.018, 0.08), this.debrisMaterial, 240);
    this.debrisMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.debrisMesh.renderOrder = 7;
    this.group.add(this.debrisMesh);

    this.arcCoreMaterial = new THREE.MeshBasicMaterial({
      color: this.configs.arcs.color,
      transparent: true,
      opacity: this.configs.arcs.opacity,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.arcGlowMaterial = new THREE.MeshBasicMaterial({
      color: this.configs.arcs.accentColor,
      transparent: true,
      opacity: this.configs.arcs.opacity * this.configs.arcs.glowStrength * 0.34,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    this.arcCoreMesh = new THREE.Mesh(new THREE.BufferGeometry(), this.arcCoreMaterial);
    this.arcGlowMesh = new THREE.Mesh(new THREE.BufferGeometry(), this.arcGlowMaterial);
    this.arcCoreMesh.name = "TornadoVfxArcCore";
    this.arcGlowMesh.name = "TornadoVfxArcGlow";
    this.arcCoreMesh.renderOrder = 8;
    this.arcGlowMesh.renderOrder = 9;
    this.arcCoreMesh.frustumCulled = false;
    this.arcGlowMesh.frustumCulled = false;
    this.group.add(this.arcCoreMesh, this.arcGlowMesh);

    this.rebuildDebris();
    this.rebuildArcs();
    this.applyAllConfigs();
  }

  update(deltaTime: number, elapsedTime: number): void {
    const dustConfig = this.configs.dust;
    const debrisConfig = this.configs.debris;
    this.tornadoMaterial.uniforms.time.value = elapsedTime;
    this.gustMaterial.uniforms.time.value = elapsedTime;
    this.shockwaveMaterial.uniforms.time.value = elapsedTime;
    this.dustMaterial.uniforms.time.value = elapsedTime;

    const dustPulse = 1 + Math.sin(elapsedTime * dustConfig.speed * 3.0) * dustConfig.pulseStrength;
    this.dustMesh.scale.setScalar(dustPulse);

    for (let i = 0; i < this.debrisStates.length; i += 1) {
      const debris = this.debrisStates[i];
      const angle = debris.phase + elapsedTime * debris.speed * debrisConfig.speed;
      const heightWave = Math.sin(elapsedTime * debris.speed + debris.phase) * 0.16;
      this.debrisPosition.set(Math.cos(angle) * debris.radius, debris.height + heightWave, Math.sin(angle) * debris.radius);
      this.debrisQuaternion.setFromEuler(new THREE.Euler(angle * 0.7, -angle, angle * 1.3));
      this.debrisScale.setScalar(debris.size * debrisConfig.debrisSize);
      this.debrisMatrix.compose(this.debrisPosition, this.debrisQuaternion, this.debrisScale);
      this.debrisMesh.setMatrixAt(i, this.debrisMatrix);
    }
    this.debrisMesh.count = this.debrisStates.length;
    this.debrisMesh.instanceMatrix.needsUpdate = true;
    this.updateArcs(deltaTime, elapsedTime);
  }

  applyPreset(preset: TornadoVfxPreset): void {
    this.configs = cloneLayerConfigs();
    this.resetEnabled();
    this.mergePreset(preset);
    this.rebuildDebris();
    this.rebuildArcs();
    this.applyAllConfigs();
  }

  dispose(): void {
    const disposedMaterials = new Set<THREE.Material>();
    const disposedGeometries = new Set<THREE.BufferGeometry>();
    for (const frame of this.arcFrames) {
      disposedGeometries.add(frame.coreGeometry);
      disposedGeometries.add(frame.glowGeometry);
      frame.coreGeometry.dispose();
      frame.glowGeometry.dispose();
    }
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.InstancedMesh || child instanceof THREE.Line) {
        if (!disposedGeometries.has(child.geometry)) {
          child.geometry.dispose();
          disposedGeometries.add(child.geometry);
        }
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const material of materials) {
          if (!disposedMaterials.has(material)) {
            material.dispose();
            disposedMaterials.add(material);
          }
        }
      }
    });
  }

  private rebuildDebris(): void {
    const config = this.configs.debris;
    const count = THREE.MathUtils.clamp(Math.round(config.debrisCount), 0, 240);
    this.debrisStates = [];

    for (let i = 0; i < count; i += 1) {
      const t = count <= 1 ? 0 : i / (count - 1);
      this.debrisStates.push({
        radius: THREE.MathUtils.lerp(config.baseWidth, config.topWidth, Math.random()) + (Math.random() - 0.5) * config.orbitRandomness,
        speed: THREE.MathUtils.lerp(0.55, 1.55, Math.random()) * (i % 2 === 0 ? 1 : -1),
        height: THREE.MathUtils.lerp(0.08, config.height, t),
        phase: Math.random() * Math.PI * 2,
        size: THREE.MathUtils.lerp(0.55, 1.45, Math.random()),
      });
    }
  }

  private rebuildArcs(): void {
    for (const frame of this.arcFrames) {
      frame.coreGeometry.dispose();
      frame.glowGeometry.dispose();
    }
    this.arcFrames = [];
    const config = this.configs.arcs;
    const frameCount = THREE.MathUtils.clamp(Math.ceil(Math.max(config.flickerRate, 20)), 1, 60);
    this.arcCycleTime = 0;
    this.arcCycleDuration = getArcCycleDuration(config);
    this.arcFrameIndex = -1;
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      this.arcFrames.push(this.createArcFrame(frameIndex + 1, config));
    }
    this.applyArcFrame(0);
  }

  private createArcFrame(seed: number, config: TornadoVfxLayerConfig): ArcFrame {
    const corePositions: number[] = [];
    const coreIndices: number[] = [];
    const glowPositions: number[] = [];
    const glowIndices: number[] = [];
    const count = THREE.MathUtils.clamp(Math.round(config.arcCount), 0, 96);
    const isGround = config.height <= 0.02;
    let coreVertexOffset = 0;
    let glowVertexOffset = 0;

    for (let i = 0; i < count; i += 1) {
      const path = this.createArcPath(seed, i, count, config, isGround);
      const smoothPath = smoothArcPath(path, config.arcSmoothness, isGround);
      coreVertexOffset = appendRibbonPath(smoothPath, config.thickness, corePositions, coreIndices, coreVertexOffset, isGround);
      if (config.glowStrength > 0) {
        glowVertexOffset = appendRibbonPath(
          smoothPath,
          config.thickness * (3.0 + config.glowStrength * 0.9),
          glowPositions,
          glowIndices,
          glowVertexOffset,
          isGround,
        );
      }

      const branches = THREE.MathUtils.clamp(Math.round(config.branchCount), 0, 12);
      for (let branch = 0; branch < branches; branch += 1) {
        const branchPath = this.createArcBranch(seed, path, branch, config, isGround);
        const smoothBranchPath = smoothArcPath(branchPath, config.arcSmoothness, isGround);
        coreVertexOffset = appendRibbonPath(
          smoothBranchPath,
          config.thickness * 0.72,
          corePositions,
          coreIndices,
          coreVertexOffset,
          isGround,
        );
        if (config.glowStrength > 0) {
          glowVertexOffset = appendRibbonPath(
            smoothBranchPath,
            config.thickness * (2.2 + config.glowStrength * 0.7),
            glowPositions,
            glowIndices,
            glowVertexOffset,
            isGround,
          );
        }
      }
    }

    return {
      coreGeometry: createArcGeometry(corePositions, coreIndices),
      glowGeometry: createArcGeometry(glowPositions, glowIndices),
    };
  }

  private updateArcs(deltaTime: number, elapsedTime: number): void {
    if (!this.enabled.arcs || this.arcFrames.length === 0) {
      return;
    }

    const config = this.configs.arcs;
    this.arcCoreMesh.rotation.y = elapsedTime * config.orbitDrift;
    this.arcGlowMesh.rotation.y = this.arcCoreMesh.rotation.y;
    this.arcCycleDuration = getArcCycleDuration(config);
    this.arcCycleTime += deltaTime;
    if (this.arcCycleTime >= this.arcCycleDuration) {
      this.arcCycleTime %= this.arcCycleDuration;
      const nextFrameIndex = (this.arcFrameIndex + 1) % this.arcFrames.length;
      this.applyArcFrame(nextFrameIndex);
    } else if (this.arcFrameIndex < 0) {
      this.applyArcFrame(0);
    }
    const arcAlpha = getArcCycleAlpha(this.arcCycleTime, config);
    this.arcCoreMaterial.opacity = config.opacity * arcAlpha;
    this.arcGlowMaterial.opacity = config.opacity * config.glowStrength * 0.34 * arcAlpha;
  }

  private applyArcFrame(frameIndex: number): void {
    const frame = this.arcFrames[frameIndex];
    if (!frame || frameIndex === this.arcFrameIndex) {
      return;
    }
    this.arcCoreMesh.geometry = frame.coreGeometry;
    this.arcGlowMesh.geometry = frame.glowGeometry;
    this.arcFrameIndex = frameIndex;
  }

  private createArcPath(
    seed: number,
    index: number,
    count: number,
    config: TornadoVfxLayerConfig,
    isGround: boolean,
  ): ArcPath {
    const points: ArcPath = [];
    const segments = 4 + Math.round(seededRandom(seed, index, 11) * 5);
    const innerRadius = Math.max(Math.min(config.baseWidth, config.topWidth), 0.01);
    const outerRadius = Math.max(config.baseWidth, config.topWidth, innerRadius + 0.01);
    const radius = THREE.MathUtils.lerp(innerRadius, outerRadius, seededRandom(seed, index, 13));
    const baseAngle = (index / Math.max(count, 1)) * Math.PI * 2 + seededRandom(seed, index, 17) * 0.75;
    const direction = seededRandom(seed, index, 23) > 0.5 ? 1 : -1;
    const angularLength = config.arcLength * Math.PI * 2 * THREE.MathUtils.lerp(0.45, 1.2, seededRandom(seed, index, 29));
    const yBase = isGround ? 0.045 : THREE.MathUtils.lerp(0.08, Math.max(config.height, 0.08), seededRandom(seed, index, 31));

    for (let segment = 0; segment <= segments; segment += 1) {
      const t = segment / segments;
      const jitter = (seededRandom(seed, index * 37 + segment, 41) - 0.5) * config.jaggedness;
      const angle = baseAngle + direction * angularLength * t + jitter;
      const radialJitter = 1 + (seededRandom(seed, index * 53 + segment, 43) - 0.5) * config.jaggedness * 0.55;
      const clampedRadius = THREE.MathUtils.clamp(radius * radialJitter, innerRadius, outerRadius);
      const yJitter = isGround ? 0 : (seededRandom(seed, index * 71 + segment, 47) - 0.5) * config.height * config.jaggedness;
      points.push(new THREE.Vector3(Math.cos(angle) * clampedRadius, yBase + yJitter, Math.sin(angle) * clampedRadius));
    }

    return points;
  }

  private createArcBranch(
    seed: number,
    path: ArcPath,
    branch: number,
    config: TornadoVfxLayerConfig,
    isGround: boolean,
  ): ArcPath {
    if (path.length < 3) {
      return [];
    }

    const startIndex = 1 + Math.floor(seededRandom(seed, branch, path.length) * (path.length - 2));
    const start = path[startIndex];
    const innerRadius = Math.max(Math.min(config.baseWidth, config.topWidth), 0.01);
    const outerRadius = Math.max(config.baseWidth, config.topWidth, innerRadius + 0.01);
    const outward = new THREE.Vector3(start.x, 0, start.z).normalize();
    const tangent = path[Math.min(startIndex + 1, path.length - 1)].clone().sub(path[Math.max(startIndex - 1, 0)]).normalize();
    const side = seededRandom(seed, branch, 79) > 0.5 ? 1 : -1;
    const branchDirection = outward.multiplyScalar(0.65).add(tangent.multiplyScalar(side * 0.8)).normalize();
    const length = config.topWidth * config.arcLength * THREE.MathUtils.lerp(0.18, 0.42, seededRandom(seed, branch, 83));
    const end = start.clone().add(branchDirection.multiplyScalar(length));
    if (!isGround) {
      end.y += (seededRandom(seed, branch, 89) - 0.5) * config.height * 0.36;
    }
    const endRadius = Math.hypot(end.x, end.z);
    if (endRadius > 0.001) {
      const clampedRadius = THREE.MathUtils.clamp(endRadius, innerRadius, outerRadius);
      end.x = (end.x / endRadius) * clampedRadius;
      end.z = (end.z / endRadius) * clampedRadius;
    }
    return [start.clone(), start.clone().lerp(end, 0.48), end];
  }

  private mergePreset(preset: TornadoVfxPreset): void {
    for (const part of tornadoVfxParts) {
      this.enabled[part] = preset.enabled?.[part] ?? this.enabled[part];
      this.configs[part] = { ...this.configs[part], ...(preset.layers?.[part] ?? {}) };
    }
  }

  private resetEnabled(): void {
    this.enabled.tornado = true;
    this.enabled.shockwave = true;
    this.enabled.gust = true;
    this.enabled.dust = true;
    this.enabled.debris = true;
    this.enabled.arcs = false;
  }

  private applyAllConfigs(): void {
    for (const part of tornadoVfxParts) {
      this.applyConfig(part);
    }
  }

  private applyConfig(part: TornadoVfxPart): void {
    const config = this.configs[part];
    const color = new THREE.Color(config.color);
    if (part === "tornado") {
      applyCommonUniforms(this.tornadoMaterial, config, color);
    } else if (part === "gust") {
      applyCommonUniforms(this.gustMaterial, config, color);
    } else if (part === "shockwave") {
      applyCommonUniforms(this.shockwaveMaterial, config, color);
      this.shockwaveMaterial.uniforms.ringFrequency.value = config.ringFrequency;
      this.shockwaveMaterial.uniforms.ringWidth.value = config.ringWidth;
      this.shockwaveMaterial.uniforms.edgeFade.value = config.edgeFade;
      this.shockwaveMesh.scale.setScalar(config.topWidth);
    } else if (part === "dust") {
      applyCommonUniforms(this.dustMaterial, config, color);
    } else if (part === "debris") {
      this.debrisMaterial.color.copy(color);
      this.debrisMaterial.opacity = config.opacity;
    } else if (part === "arcs") {
      this.arcCoreMaterial.color.copy(color);
      this.arcCoreMaterial.opacity = config.opacity;
      this.arcCoreMaterial.blending = getBlendMode(config.blendMode);
      this.arcGlowMaterial.color.set(config.accentColor);
      this.arcGlowMaterial.opacity = config.opacity * config.glowStrength * 0.34;
      this.arcGlowMaterial.blending = getBlendMode(config.blendMode);
    }
    this.applyVisibility();
  }

  private applyVisibility(): void {
    this.tornadoMesh.visible = this.enabled.tornado;
    this.shockwaveMesh.visible = this.enabled.shockwave;
    this.gustMesh.visible = this.enabled.gust;
    this.dustMesh.visible = this.enabled.dust;
    this.debrisMesh.visible = this.enabled.debris && this.debrisStates.length > 0;
    this.arcCoreMesh.visible = this.enabled.arcs && this.arcFrames.length > 0;
    this.arcGlowMesh.visible = this.enabled.arcs && this.configs.arcs.glowStrength > 0 && this.arcFrames.length > 0;
  }
}

function getBlendMode(blendMode: TornadoVfxLayerConfig["blendMode"]): THREE.Blending {
  if (blendMode === "normal") {
    return THREE.NormalBlending;
  }
  if (blendMode === "multiply") {
    return THREE.MultiplyBlending;
  }
  return THREE.AdditiveBlending;
}

function appendRibbonPath(
  points: ArcPath,
  width: number,
  positions: number[],
  indices: number[],
  vertexOffset: number,
  isGround: boolean,
): number {
  if (points.length < 2 || width <= 0) {
    return vertexOffset;
  }

  for (let i = 0; i < points.length; i += 1) {
    const previous = points[Math.max(i - 1, 0)];
    const next = points[Math.min(i + 1, points.length - 1)];
    const tangent = next.clone().sub(previous);
    if (tangent.lengthSq() < 0.0001) {
      tangent.set(1, 0, 0);
    } else {
      tangent.normalize();
    }
    const normal = isGround ? new THREE.Vector3(-tangent.z, 0, tangent.x) : tangent.clone().cross(new THREE.Vector3(0, 1, 0));
    if (normal.lengthSq() < 0.0001) {
      normal.set(1, 0, 0);
    } else {
      normal.normalize();
    }
    const point = points[i];
    const left = point.clone().addScaledVector(normal, width * 0.5);
    const right = point.clone().addScaledVector(normal, -width * 0.5);
    positions.push(left.x, left.y, left.z, right.x, right.y, right.z);

    if (i < points.length - 1) {
      const start = vertexOffset + i * 2;
      indices.push(start, start + 2, start + 1, start + 1, start + 2, start + 3);
    }
  }

  return vertexOffset + points.length * 2;
}

function smoothArcPath(points: ArcPath, smoothness: number, isGround: boolean): ArcPath {
  const passes = Math.round(THREE.MathUtils.clamp(smoothness, 0, 1) * 3);
  let smoothed = points.map((point) => point.clone());

  for (let pass = 0; pass < passes; pass += 1) {
    if (smoothed.length < 3) {
      break;
    }
    const nextPoints: ArcPath = [smoothed[0].clone()];
    for (let i = 0; i < smoothed.length - 1; i += 1) {
      const current = smoothed[i];
      const next = smoothed[i + 1];
      const q = current.clone().lerp(next, 0.25);
      const r = current.clone().lerp(next, 0.75);
      if (isGround) {
        q.y = current.y;
        r.y = current.y;
      }
      nextPoints.push(q, r);
    }
    nextPoints.push(smoothed[smoothed.length - 1].clone());
    smoothed = nextPoints;
  }

  return smoothed;
}

function getArcCycleDuration(config: TornadoVfxLayerConfig): number {
  const explicitDuration = config.arcFlashIn + config.arcHold + config.arcFlashOut + config.arcRest;
  if (explicitDuration > 0.001) {
    return explicitDuration;
  }
  return config.flickerRate > 0 ? 1 / config.flickerRate : 1;
}

function getArcCycleAlpha(time: number, config: TornadoVfxLayerConfig): number {
  const flashIn = Math.max(config.arcFlashIn, 0);
  const hold = Math.max(config.arcHold, 0);
  const flashOut = Math.max(config.arcFlashOut, 0);
  const activeDuration = flashIn + hold + flashOut;

  if (activeDuration <= 0.001) {
    return 1;
  }
  if (time < flashIn) {
    return flashIn <= 0.001 ? 1 : smoothStep01(time / flashIn);
  }
  if (time < flashIn + hold) {
    return 1;
  }
  if (time < activeDuration) {
    return flashOut <= 0.001 ? 0 : 1 - smoothStep01((time - flashIn - hold) / flashOut);
  }
  return 0;
}

function smoothStep01(value: number): number {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function createArcGeometry(positions: number[], indices: number[]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function seededRandom(seed: number, a: number, b: number): number {
  return THREE.MathUtils.seededRandom(seed * 1009 + a * 9176 + b * 131);
}

export function getDefaultTornadoVfxConfig(): TornadoVfxConfig {
  return { ...defaultConfig };
}

function createTornadoMaterial(config: TornadoVfxConfig): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: createCommonUniforms(config),
    vertexShader: tornadoVertexShader,
    fragmentShader: tornadoFragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}

function createGustMaterial(config: TornadoVfxConfig): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: createCommonUniforms(config),
    vertexShader: gustVertexShader,
    fragmentShader: gustFragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}

function createShockwaveMaterial(config: TornadoVfxConfig): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: createCommonUniforms(config),
    vertexShader: shockwaveVertexShader,
    fragmentShader: shockwaveFragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}

function createCommonUniforms(config: TornadoVfxConfig): Record<string, THREE.IUniform> {
  return {
    time: { value: 0 },
    color: { value: new THREE.Color(config.color) },
    accentColor: { value: new THREE.Color(config.accentColor) },
    rimColor: { value: new THREE.Color(config.rimColor) },
    height: { value: config.height },
    baseWidth: { value: config.baseWidth },
    topWidth: { value: config.topWidth },
    twist: { value: config.twist },
    speed: { value: config.speed },
    opacity: { value: config.opacity },
    noiseStrength: { value: config.noise },
    intensity: { value: config.intensity },
    rimStrength: { value: config.rimStrength },
    rimPower: { value: config.rimPower },
    streakDensity: { value: config.streakDensity },
    streakSharpness: { value: config.streakSharpness },
    waveStrength: { value: config.waveStrength },
    displaceStrength: { value: config.displaceStrength },
    edgeSoftness: { value: config.edgeSoftness },
    ringFrequency: { value: config.ringFrequency },
    ringWidth: { value: config.ringWidth },
    edgeFade: { value: config.edgeFade },
  };
}

function applyCommonUniforms(
  material: THREE.ShaderMaterial,
  config: TornadoVfxConfig,
  color: THREE.Color,
): void {
  material.uniforms.color.value.copy(color);
  material.uniforms.accentColor.value.set(config.accentColor);
  material.uniforms.rimColor.value.set(config.rimColor);
  material.uniforms.height.value = config.height;
  material.uniforms.baseWidth.value = config.baseWidth;
  material.uniforms.topWidth.value = config.topWidth;
  material.uniforms.twist.value = config.twist;
  material.uniforms.speed.value = config.speed;
  material.uniforms.opacity.value = config.opacity;
  material.uniforms.noiseStrength.value = config.noise;
  material.uniforms.intensity.value = config.intensity;
  material.uniforms.rimStrength.value = config.rimStrength;
  material.uniforms.rimPower.value = config.rimPower;
  material.uniforms.streakDensity.value = config.streakDensity;
  material.uniforms.streakSharpness.value = config.streakSharpness;
  material.uniforms.waveStrength.value = config.waveStrength;
  material.uniforms.displaceStrength.value = config.displaceStrength;
  material.uniforms.edgeSoftness.value = config.edgeSoftness;
}

function cloneLayerConfigs(
  source: Record<TornadoVfxPart, TornadoVfxLayerConfig> = defaultLayerConfigs,
): Record<TornadoVfxPart, TornadoVfxLayerConfig> {
  return {
    tornado: { ...source.tornado },
    shockwave: { ...source.shockwave },
    gust: { ...source.gust },
    dust: { ...source.dust },
    debris: { ...source.debris },
    arcs: { ...source.arcs },
  };
}
