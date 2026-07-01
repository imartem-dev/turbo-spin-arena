import * as THREE from "three";

export type StylizedOrbVfxPoolOptions = {
  size?: number;
  sparkCount?: number;
  sparkRadius?: number;
};

type OrbSharedResources = {
  glowGeometry: THREE.PlaneGeometry;
  coreGeometry: THREE.PlaneGeometry;
  sparkGeometry: THREE.PlaneGeometry;
  glowTexture: THREE.CanvasTexture;
};

const billboardVertexShader = /* glsl */ `
  uniform float uScale;
  uniform float uTime;
  uniform float uPhase;
  uniform float uPulseAmount;

  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec4 viewCenter = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    float pulse = 1.0 + sin(uTime * 5.1 + uPhase) * uPulseAmount;
    viewCenter.xy += position.xy * uScale * pulse;
    gl_Position = projectionMatrix * viewCenter;
  }
`;

const plasmaNoiseGlsl = /* glsl */ `
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float valueNoise(vec2 p) {
    vec2 cell = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(cell), hash21(cell + vec2(1.0, 0.0)), f.x),
      mix(hash21(cell + vec2(0.0, 1.0)), hash21(cell + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.55;
    for (int octave = 0; octave < 3; octave++) {
      value += valueNoise(p) * amplitude;
      p = p * 2.03 + vec2(7.1, 3.7);
      amplitude *= 0.48;
    }
    return value;
  }

  mat2 rotation2d(float angle) {
    float sine = sin(angle);
    float cosine = cos(angle);
    return mat2(cosine, -sine, sine, cosine);
  }
`;

const glowFragmentShader = /* glsl */ `
  uniform sampler2D uGlowMap;
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uPhase;

  varying vec2 vUv;

  ${plasmaNoiseGlsl}

  void main() {
    float glow = texture2D(uGlowMap, vUv).a;
    glow *= glow;
    vec2 plasmaUv = (vUv - 0.5) * 2.0;
    float firstFlow = fbm(plasmaUv * 2.75 + vec2(uTime * 2.25, -uTime * 0.11) + uPhase);
    float secondFlow = fbm(
      plasmaUv * 2.8 + vec2(-uTime * 2.09, uTime * 0.13) + vec2(5.3, 18.1) - uPhase
    );
    float plasma = smoothstep(0.38, 0.68, mix(firstFlow, secondFlow, 0.42));
    float brightnessMask = mix(0.38, 1.12, plasma);
    float opacityMask = mix(0.52, 1.0, plasma);
    gl_FragColor = vec4(
      uColor * uIntensity * glow * brightnessMask,
      glow * uOpacity * opacityMask
    );
  }
`;

const coreFragmentShader = /* glsl */ `
  uniform sampler2D uGlowMap;
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uTime;
  uniform float uPhase;

  varying vec2 vUv;

  ${plasmaNoiseGlsl}

  void main() {
    float radial = texture2D(uGlowMap, vUv).a;
    float distanceFromCenter = length(vUv - 0.5) * 2.0;
    float whiteCore = 1.0 - smoothstep(0.0, 0.24, distanceFromCenter);
    vec3 color = mix(uColor * 1.25, vec3(1.0) * uIntensity, whiteCore);
    vec2 centeredUv = (vUv - 0.5) * 2.0;
    vec2 plasmaUv = rotation2d(uTime * 0.7 + uPhase) * centeredUv;
    float firstFlow = fbm(plasmaUv * 2.1 + vec2(uTime * 0.13, -uTime * 0.09));
    float secondFlow = fbm(plasmaUv * 5.6 - vec2(uTime * 0.75, uTime * 0.12) + 6.7);
    float plasma = smoothstep(0.5, 0.1, mix(firstFlow, secondFlow, 0.36));
    float plasmaMask = mix(0.9, 1.9, plasma);
    float brightnessPulse = 1.0 + sin(uTime * 5.1 + uPhase) * 0.08;
    float alpha = smoothstep(0.01, 0.92, radial) * mix(0.68, 1.0, plasma);
    gl_FragColor = vec4(color * radial * plasmaMask * brightnessPulse, alpha);
  }
`;

const sparkVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uTurbulence;

  attribute vec3 aSpawnPosition;
  attribute vec3 aSeed;
  attribute vec2 aLife;

  varying vec2 vUv;
  varying float vLife;

  float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  float noise3d(vec3 p) {
    vec3 cell = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    return mix(
      mix(mix(hash31(cell + vec3(0.0, 0.0, 0.0)), hash31(cell + vec3(1.0, 0.0, 0.0)), f.x),
          mix(hash31(cell + vec3(0.0, 1.0, 0.0)), hash31(cell + vec3(1.0, 1.0, 0.0)), f.x), f.y),
      mix(mix(hash31(cell + vec3(0.0, 0.0, 1.0)), hash31(cell + vec3(1.0, 0.0, 1.0)), f.x),
          mix(hash31(cell + vec3(0.0, 1.0, 1.0)), hash31(cell + vec3(1.0, 1.0, 1.0)), f.x), f.y),
      f.z
    );
  }

  vec3 turbulence(vec3 p, float time) {
    vec3 q = p * 4.0 + aSeed * 7.0;
    return vec3(
      noise3d(q + vec3(time * 0.72, 0.0, 0.0)),
      noise3d(q + vec3(0.0, time * 0.61, 11.7)),
      noise3d(q + vec3(7.3, 0.0, time * 0.68))
    ) * 2.0 - 1.0;
  }

  void main() {
    vUv = uv;
    float life = fract(uTime / aLife.y + aLife.x);
    float fadeIn = smoothstep(0.0, 0.1, life);
    float fadeOut = 1.0 - smoothstep(0.58, 1.0, life);
    vLife = fadeIn * fadeOut;

    float cycleTime = life * aLife.y;
    vec3 localCenter = aSpawnPosition;
    localCenter += turbulence(aSpawnPosition, uTime + aSeed.x * 8.0) * uTurbulence;
    localCenter += vec3(
      sin(cycleTime * (1.7 + aSeed.x) + aSeed.y * 6.2831),
      cos(cycleTime * (1.4 + aSeed.y) + aSeed.z * 6.2831),
      sin(cycleTime * (1.9 + aSeed.z) + aSeed.x * 6.2831)
    ) * 0.045;

    vec4 viewCenter = modelViewMatrix * instanceMatrix * vec4(localCenter, 1.0);
    // Keep visible sparks large enough for the radial mask to cover several pixels.
    // Opacity falls faster than size, so the final sub-pixel stage is invisible.
    float size = mix(0.04, 0.08, aSeed.z) * sqrt(vLife);
    viewCenter.xy += position.xy * size;
    gl_Position = projectionMatrix * viewCenter;
  }
`;

const sparkFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;

  varying vec2 vUv;
  varying float vLife;

  void main() {
    vec2 centeredUv = (vUv - 0.5) * 2.0;
    float radiusSquared = dot(centeredUv, centeredUv);
    if (radiusSquared >= 1.0) {
      discard;
    }

    float gaussian = exp(-radiusSquared * 3.2);
    float softEdge = 1.0 - smoothstep(0.01, 1.0, radiusSquared);
    float alpha = gaussian * softEdge * vLife * vLife * 0.72;
    vec3 color = mix(uColor, vec3(1.0), 0.18) * uIntensity;
    gl_FragColor = vec4(color, alpha);
  }
`;

export class StylizedOrbVfx {
  readonly group = new THREE.Group();

  private readonly glowMaterial: THREE.ShaderMaterial;
  private readonly coreMaterial: THREE.ShaderMaterial;
  private readonly sparkMaterial: THREE.ShaderMaterial;
  private _active = false;

  constructor(resources: OrbSharedResources, index: number) {
    this.group.name = `Stylized Orb ${index}`;
    this.group.visible = false;

    this.glowMaterial = createBillboardMaterial(resources.glowTexture, glowFragmentShader, {
      uScale: { value: 1.65 },
      uIntensity: { value: 5.25 },
      uOpacity: { value: 0.4 },
      uPhase: { value: index * 1.37 },
    });
    this.coreMaterial = createBillboardMaterial(resources.glowTexture, coreFragmentShader, {
      uScale: { value: 1.5 },
      uIntensity: { value: 1.5 },
      uPhase: { value: index * 1.37 },
      uPulseAmount: { value: 0.03 },
    });
    this.sparkMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: index * 0.73 },
        uColor: { value: new THREE.Color("#ff1c1c") },
        uIntensity: { value: 4.35 },
        uTurbulence: { value: 0.4 },
      },
      vertexShader: sparkVertexShader,
      fragmentShader: sparkFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });

    const glow = new THREE.Mesh(resources.glowGeometry, this.glowMaterial);
    glow.name = "Orb Glow Background";
    glow.renderOrder = 4;
    glow.frustumCulled = false;

    const core = new THREE.Mesh(resources.coreGeometry, this.coreMaterial);
    core.name = "Orb Bright Core";
    core.renderOrder = 5;
    core.frustumCulled = false;

    const sparks = new THREE.InstancedMesh(
      resources.sparkGeometry,
      this.sparkMaterial,
      resources.sparkGeometry.getAttribute("aLife").count,
    );
    sparks.name = "Orb Floating Sparks";
    sparks.renderOrder = 6;
    sparks.frustumCulled = false;
    const identity = new THREE.Matrix4();
    for (let i = 0; i < sparks.count; i += 1) {
      sparks.setMatrixAt(i, identity);
    }
    sparks.instanceMatrix.needsUpdate = true;

    this.group.add(glow, core, sparks);
  }

  get active(): boolean {
    return this._active;
  }

  setPosition(position: THREE.Vector3): void {
    this.group.position.copy(position);
  }

  setColor(color: THREE.ColorRepresentation): void {
    this.glowMaterial.uniforms.uColor.value.set(color);
    this.coreMaterial.uniforms.uColor.value.set(color);
    this.sparkMaterial.uniforms.uColor.value.set(color);
  }

  update(elapsedTime: number): void {
    if (this._active) {
      this.glowMaterial.uniforms.uTime.value = elapsedTime;
      this.coreMaterial.uniforms.uTime.value = elapsedTime;
      this.sparkMaterial.uniforms.uTime.value = elapsedTime;
    }
  }

  activate(position: THREE.Vector3, color: THREE.ColorRepresentation): void {
    this.setPosition(position);
    this.setColor(color);
    this._active = true;
    this.group.visible = true;
  }

  deactivate(): void {
    this._active = false;
    this.group.visible = false;
  }

  dispose(): void {
    this.glowMaterial.dispose();
    this.coreMaterial.dispose();
    this.sparkMaterial.dispose();
  }
}

export class StylizedOrbVfxPool {
  readonly group = new THREE.Group();

  private readonly resources: OrbSharedResources;
  private readonly orbs: StylizedOrbVfx[];
  private readonly orbSet: Set<StylizedOrbVfx>;

  constructor(options: StylizedOrbVfxPoolOptions = {}) {
    const size = Math.max(1, Math.floor(options.size ?? 5));
    const sparkCount = Math.max(1, Math.floor(options.sparkCount ?? 25));
    const sparkRadius = Math.max(0.01, options.sparkRadius ?? 0.45);

    this.group.name = "Stylized Orb VFX Pool";
    this.resources = createSharedResources(sparkCount, sparkRadius);
    this.orbs = Array.from({ length: size }, (_, index) => {
      const orb = new StylizedOrbVfx(this.resources, index);
      this.group.add(orb.group);
      return orb;
    });
    this.orbSet = new Set(this.orbs);
  }

  acquire(position: THREE.Vector3, color: THREE.ColorRepresentation): StylizedOrbVfx | null {
    const orb = this.orbs.find((candidate) => !candidate.active);
    if (!orb) {
      return null;
    }
    orb.activate(position, color);
    return orb;
  }

  release(orb: StylizedOrbVfx): void {
    if (this.orbSet.has(orb)) {
      orb.deactivate();
    }
  }

  update(_deltaTime: number, elapsedTime: number): void {
    for (const orb of this.orbs) {
      orb.update(elapsedTime);
    }
  }

  dispose(): void {
    for (const orb of this.orbs) {
      orb.dispose();
    }
    this.resources.glowGeometry.dispose();
    this.resources.coreGeometry.dispose();
    this.resources.sparkGeometry.dispose();
    this.resources.glowTexture.dispose();
  }
}

function createSharedResources(sparkCount: number, sparkRadius: number): OrbSharedResources {
  return {
    glowGeometry: new THREE.PlaneGeometry(1, 1),
    coreGeometry: new THREE.PlaneGeometry(1, 1),
    sparkGeometry: createSparkGeometry(sparkCount, sparkRadius),
    glowTexture: createSoftRadialGlowTexture(),
  };
}

function createBillboardMaterial(
  texture: THREE.Texture,
  fragmentShader: string,
  extraUniforms: Record<string, THREE.IUniform>,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uGlowMap: { value: texture },
      uColor: { value: new THREE.Color("#ff1c1c") },
      uTime: { value: 0 },
      uPhase: { value: 0 },
      uPulseAmount: { value: 0 },
      ...extraUniforms,
    },
    vertexShader: billboardVertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

function createSparkGeometry(count: number, radius: number): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(1, 1);
  const spawnPositions = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 3);
  const lives = new Float32Array(count * 2);

  for (let i = 0; i < count; i += 1) {
    const seedX = random01(i, 1);
    const seedY = random01(i, 2);
    const seedZ = random01(i, 3);
    const z = seedX * 2 - 1;
    const angle = seedY * Math.PI * 2;
    const distance = Math.cbrt(seedZ) * radius;
    const radial = Math.sqrt(Math.max(0, 1 - z * z)) * distance;

    spawnPositions[i * 3] = Math.cos(angle) * radial;
    spawnPositions[i * 3 + 1] = z * distance;
    spawnPositions[i * 3 + 2] = Math.sin(angle) * radial;
    seeds[i * 3] = random01(i, 4);
    seeds[i * 3 + 1] = random01(i, 5);
    seeds[i * 3 + 2] = random01(i, 6);
    lives[i * 2] = random01(i, 7);
    lives[i * 2 + 1] = THREE.MathUtils.lerp(0.85, 1.8, random01(i, 8));
  }

  geometry.setAttribute("aSpawnPosition", new THREE.InstancedBufferAttribute(spawnPositions, 3));
  geometry.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 3));
  geometry.setAttribute("aLife", new THREE.InstancedBufferAttribute(lives, 2));
  return geometry;
}

function createSoftRadialGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not create radial glow texture");
  }

  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.2, "rgba(255,255,255,0.98)");
  gradient.addColorStop(0.52, "rgba(255,255,255,0.45)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.name = "Soft Radial Glow";
  texture.colorSpace = THREE.NoColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

function random01(index: number, salt: number): number {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453123;
  return value - Math.floor(value);
}
