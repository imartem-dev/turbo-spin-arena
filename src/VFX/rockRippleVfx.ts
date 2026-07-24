import * as THREE from "three";

export type RockRippleVfxConfig = {
  poolSize: number;
  rocksPerRing: number;
  ringRadii: [number, number, number];
  ringDelays: [number, number, number];
  duration: number;
  rockLifetime: number;
  dustLifetime: number;
  debrisLifetime: number;
  debrisPerRock: number;
  rockShadowColor: string;
  rockBaseColor: string;
  rockLightColor: string;
  rockOutlineColor: string;
  rockOutlineThickness: number;
  dustColor: string;
  lightDirection: [number, number, number];
};

type RockRippleTextures = {
  cellular: THREE.Texture;
};

type RockLayout = {
  rockMatrices: THREE.Matrix4[];
  dustMatrices: THREE.Matrix4[];
  debrisMatrices: THREE.Matrix4[];
  rockDelays: Float32Array;
  rockSeeds: Float32Array;
  debrisDelays: Float32Array;
  debrisSeeds: Float32Array;
  debrisDirections: Float32Array;
};

const textureBase = `${import.meta.env.BASE_URL}assets/vfx/rock-ripple/`;
const buriedBaseY = -0.16;

export const defaultRockRippleVfxConfig: RockRippleVfxConfig = {
  poolSize: 4,
  rocksPerRing: 7,
  ringRadii: [3.6, 5.2, 7.6],
  ringDelays: [0, 0.2, 0.4],
  duration: 1,
  rockLifetime: 0.6,
  dustLifetime: 0.58,
  debrisLifetime: 0.62,
  debrisPerRock: 2,
  rockShadowColor: "#c0a091",
  rockBaseColor: "#947c76",
  rockLightColor: "#746665",
  rockOutlineColor: "#100b0a",
  rockOutlineThickness: 0.045,
  dustColor: "#756052",
  lightDirection: [0, -0.74, 0.68],
};

export class RockRippleVfxPool {
  readonly group = new THREE.Group();

  private readonly config: RockRippleVfxConfig;
  private readonly textures: RockRippleTextures;
  private readonly rockGeometry: THREE.BufferGeometry;
  private readonly dustGeometry: THREE.PlaneGeometry;
  private readonly debrisGeometry: THREE.BufferGeometry;
  private readonly instances: RockRippleVfxInstance[];
  private nextIndex = 0;

  constructor(config: Partial<RockRippleVfxConfig> = {}) {
    this.config = { ...defaultRockRippleVfxConfig, ...config };
    this.group.name = "Rock Ripple VFX Pool";

    const layout = createRockLayout(this.config);
    this.textures = loadTextures();
    this.rockGeometry = createRockSpikeGeometry(layout);
    this.dustGeometry = createGroundPlaneGeometry(layout.rockDelays, layout.rockSeeds);
    this.debrisGeometry = createDebrisGeometry(layout);

    this.instances = Array.from({ length: this.config.poolSize }, (_, index) => {
      const instance = new RockRippleVfxInstance(
        this.config,
        this.textures,
        this.rockGeometry,
        this.dustGeometry,
        this.debrisGeometry,
        layout,
        index,
      );
      this.group.add(instance.group);
      return instance;
    });
  }

  spawn(position: THREE.Vector3): void {
    const instance = this.instances[this.nextIndex];
    this.nextIndex = (this.nextIndex + 1) % this.instances.length;
    instance.spawn(position);
  }

  update(deltaTime: number, _elapsedTime: number): void {
    for (const instance of this.instances) {
      instance.update(deltaTime);
    }
  }

  dispose(): void {
    for (const instance of this.instances) {
      instance.dispose();
    }
    this.rockGeometry.dispose();
    this.dustGeometry.dispose();
    this.debrisGeometry.dispose();
    this.textures.cellular.dispose();
  }
}

class RockRippleVfxInstance {
  readonly group = new THREE.Group();

  private readonly config: RockRippleVfxConfig;
  private readonly rockMaterial: THREE.ShaderMaterial;
  private readonly outlineMaterial: THREE.ShaderMaterial;
  private readonly dustMaterial: THREE.ShaderMaterial;
  private readonly debrisMaterial: THREE.ShaderMaterial;
  private age = 0;
  private active = false;

  constructor(
    config: RockRippleVfxConfig,
    textures: RockRippleTextures,
    rockGeometry: THREE.BufferGeometry,
    dustGeometry: THREE.PlaneGeometry,
    debrisGeometry: THREE.BufferGeometry,
    layout: RockLayout,
    index: number,
  ) {
    this.config = config;
    this.group.name = `Rock Ripple VFX ${index}`;
    this.group.visible = false;

    this.outlineMaterial = createOutlineMaterial(config);
    const outlineMesh = new THREE.InstancedMesh(rockGeometry, this.outlineMaterial, layout.rockMatrices.length);
    outlineMesh.name = "Rock Ripple Outlines";
    outlineMesh.frustumCulled = false;
    outlineMesh.renderOrder = 2;
    setInstanceMatrices(outlineMesh, layout.rockMatrices);

    this.rockMaterial = createRockMaterial(config, textures.cellular);
    const rockMesh = new THREE.InstancedMesh(rockGeometry, this.rockMaterial, layout.rockMatrices.length);
    rockMesh.name = "Rock Ripple Stones";
    rockMesh.frustumCulled = false;
    rockMesh.renderOrder = 3;
    setInstanceMatrices(rockMesh, layout.rockMatrices);

    this.dustMaterial = createDustMaterial(config, textures.cellular);
    const dustMesh = new THREE.InstancedMesh(dustGeometry, this.dustMaterial, layout.dustMatrices.length);
    dustMesh.name = "Rock Ripple Dust";
    dustMesh.frustumCulled = false;
    dustMesh.renderOrder = 4;
    setInstanceMatrices(dustMesh, layout.dustMatrices);

    this.debrisMaterial = createDebrisMaterial(config);
    const debrisMesh = new THREE.InstancedMesh(debrisGeometry, this.debrisMaterial, layout.debrisMatrices.length);
    debrisMesh.name = "Rock Ripple Debris";
    debrisMesh.frustumCulled = false;
    debrisMesh.renderOrder = 3;
    setInstanceMatrices(debrisMesh, layout.debrisMatrices);

    this.group.add(outlineMesh, rockMesh, debrisMesh, dustMesh);
  }

  spawn(position: THREE.Vector3): void {
    this.age = 0;
    this.active = true;
    this.group.position.copy(position);
    this.group.visible = true;
  }

  update(deltaTime: number): void {
    if (!this.active) {
      return;
    }

    this.age += deltaTime;
    if (this.age >= this.config.duration) {
      this.active = false;
      this.group.visible = false;
      return;
    }

    setAge(this.rockMaterial, this.age);
    setAge(this.outlineMaterial, this.age);
    setAge(this.dustMaterial, this.age);
    setAge(this.debrisMaterial, this.age);
  }

  dispose(): void {
    this.rockMaterial.dispose();
    this.outlineMaterial.dispose();
    this.dustMaterial.dispose();
    this.debrisMaterial.dispose();
  }
}

function loadTextures(): RockRippleTextures {
  const loader = new THREE.TextureLoader();
  const cellular = loader.load(`${textureBase}T_VFX_NoiseF1.webp`);
  cellular.wrapS = THREE.RepeatWrapping;
  cellular.wrapT = THREE.RepeatWrapping;
  cellular.needsUpdate = true;
  return { cellular };
}

function createRockLayout(config: RockRippleVfxConfig): RockLayout {
  const rockCount = config.rocksPerRing * config.ringRadii.length;
  const debrisCount = rockCount * config.debrisPerRock;
  const rockMatrices: THREE.Matrix4[] = [];
  const dustMatrices: THREE.Matrix4[] = [];
  const debrisMatrices: THREE.Matrix4[] = [];
  const rockDelays = new Float32Array(rockCount);
  const rockSeeds = new Float32Array(rockCount);
  const debrisDelays = new Float32Array(debrisCount);
  const debrisSeeds = new Float32Array(debrisCount);
  const debrisDirections = new Float32Array(debrisCount * 3);
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const euler = new THREE.Euler();

  for (let ring = 0; ring < config.ringRadii.length; ring += 1) {
    const angleOffset = ring * 0.31;
    const ringScale = THREE.MathUtils.lerp(0.52, 0.82, ring / Math.max(1, config.ringRadii.length - 1));

    for (let rock = 0; rock < config.rocksPerRing; rock += 1) {
      const index = ring * config.rocksPerRing + rock;
      const seed = hash(index * 3.17 + 11.4);
      const angle = (rock / config.rocksPerRing) * Math.PI * 2 + angleOffset;
      const radius = config.ringRadii[ring];
      position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      euler.set(0, angle + hash(index + 8.9) * Math.PI, 0);
      rotation.setFromEuler(euler);
      scale.set(
        ringScale * THREE.MathUtils.lerp(0.72, 1.08, hash(index + 2.1)),
        ringScale * THREE.MathUtils.lerp(1.05, 1.52, hash(index + 7.3)),
        ringScale * THREE.MathUtils.lerp(0.7, 1.04, hash(index + 5.4)),
      );
      rockMatrices.push(new THREE.Matrix4().compose(position, rotation, scale));

      const dustScale = ringScale * THREE.MathUtils.lerp(0.82, 1.06, hash(index + 9.6));
      scale.set(dustScale, dustScale, dustScale);
      dustMatrices.push(new THREE.Matrix4().compose(position, new THREE.Quaternion(), scale));

      rockDelays[index] = config.ringDelays[ring];
      rockSeeds[index] = seed;

      for (let debris = 0; debris < config.debrisPerRock; debris += 1) {
        const debrisIndex = index * config.debrisPerRock + debris;
        const debrisSeed = hash(debrisIndex * 2.73 + 21.8);
        const debrisAngle = angle + (debrisSeed - 0.5) * 1.9;
        const debrisRadius = THREE.MathUtils.lerp(0.18, 0.38, hash(debrisIndex + 2.6));
        position.set(
          Math.cos(angle) * radius + Math.cos(debrisAngle) * debrisRadius,
          0.025,
          Math.sin(angle) * radius + Math.sin(debrisAngle) * debrisRadius,
        );
        euler.set(debrisSeed * Math.PI, hash(debrisIndex + 5.1) * Math.PI * 2, 0);
        rotation.setFromEuler(euler);
        const debrisScale = ringScale * THREE.MathUtils.lerp(0.1, 0.19, hash(debrisIndex + 7.4));
        scale.setScalar(debrisScale);
        debrisMatrices.push(new THREE.Matrix4().compose(position, rotation, scale));
        debrisDelays[debrisIndex] = config.ringDelays[ring] + debris * 0.025;
        debrisSeeds[debrisIndex] = debrisSeed;
        debrisDirections[debrisIndex * 3] = Math.cos(debrisAngle) * THREE.MathUtils.lerp(0.35, 0.72, debrisSeed);
        debrisDirections[debrisIndex * 3 + 1] = THREE.MathUtils.lerp(0.22, 0.42, hash(debrisIndex + 4.4));
        debrisDirections[debrisIndex * 3 + 2] = Math.sin(debrisAngle) * THREE.MathUtils.lerp(0.35, 0.72, debrisSeed);
      }
    }
  }

  return {
    rockMatrices,
    dustMatrices,
    debrisMatrices,
    rockDelays,
    rockSeeds,
    debrisDelays,
    debrisSeeds,
    debrisDirections,
  };
}

function createRockSpikeGeometry(layout: RockLayout): THREE.BufferGeometry {
  const sideCount = 7;
  const base: THREE.Vector3[] = [];
  const shoulder: THREE.Vector3[] = [];
  const tip = new THREE.Vector3(0.18, 1.92, -0.1);

  for (let i = 0; i < sideCount; i += 1) {
    const angle = (i / sideCount) * Math.PI * 2;
    const baseRadius = 1 + Math.sin(i * 2.17) * 0.11;
    const shoulderRadius = 0.5 + Math.cos(i * 1.73) * 0.1;
    base.push(new THREE.Vector3(Math.cos(angle) * baseRadius, buriedBaseY, Math.sin(angle) * baseRadius));
    shoulder.push(
      new THREE.Vector3(
        Math.cos(angle + 0.14) * shoulderRadius + 0.08,
        0.72 + Math.sin(i * 1.31) * 0.08,
        Math.sin(angle + 0.14) * shoulderRadius - 0.04,
      ),
    );
  }

  const positions: number[] = [];
  const appendTriangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): void => {
    positions.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z);
  };

  for (let i = 0; i < sideCount; i += 1) {
    const next = (i + 1) % sideCount;
    appendTriangle(base[i], base[next], shoulder[next]);
    appendTriangle(base[i], shoulder[next], shoulder[i]);
    appendTriangle(shoulder[i], shoulder[next], tip);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.setAttribute("instanceDelay", new THREE.InstancedBufferAttribute(layout.rockDelays, 1));
  geometry.setAttribute("instanceSeed", new THREE.InstancedBufferAttribute(layout.rockSeeds, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

function createGroundPlaneGeometry(delays: Float32Array, seeds: Float32Array): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(1, 1);
  geometry.rotateX(-Math.PI / 2);
  geometry.setAttribute("instanceDelay", new THREE.InstancedBufferAttribute(delays, 1));
  geometry.setAttribute("instanceSeed", new THREE.InstancedBufferAttribute(seeds, 1));
  return geometry;
}

function createDebrisGeometry(layout: RockLayout): THREE.BufferGeometry {
  const geometry = new THREE.TetrahedronGeometry(1, 0);
  geometry.setAttribute("instanceDelay", new THREE.InstancedBufferAttribute(layout.debrisDelays, 1));
  geometry.setAttribute("instanceSeed", new THREE.InstancedBufferAttribute(layout.debrisSeeds, 1));
  geometry.setAttribute("instanceDirection", new THREE.InstancedBufferAttribute(layout.debrisDirections, 3));
  return geometry;
}

function setInstanceMatrices(mesh: THREE.InstancedMesh, matrices: THREE.Matrix4[]): void {
  for (let i = 0; i < matrices.length; i += 1) {
    mesh.setMatrixAt(i, matrices[i]);
  }
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  mesh.instanceMatrix.needsUpdate = true;
}

function createRockShapeUniforms(config: RockRippleVfxConfig, outlineThickness: number) {
  return {
    uAge: { value: 0 },
    uRockLifetime: { value: config.rockLifetime },
    uOutlineThickness: { value: outlineThickness },
  };
}

function createRockMaterial(config: RockRippleVfxConfig, cellular: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...createRockShapeUniforms(config, 0),
      uCellular: { value: cellular },
      uShadowColor: { value: new THREE.Color(config.rockShadowColor) },
      uBaseColor: { value: new THREE.Color(config.rockBaseColor) },
      uLightColor: { value: new THREE.Color(config.rockLightColor) },
      uLightDirection: { value: new THREE.Vector3().fromArray(config.lightDirection).normalize() },
    },
    vertexShader: rockVertexShader,
    fragmentShader: rockFragmentShader,
    transparent: false,
    depthWrite: true,
    depthTest: true,
  });
}

function createOutlineMaterial(config: RockRippleVfxConfig): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...createRockShapeUniforms(config, config.rockOutlineThickness),
      uOutlineColor: { value: new THREE.Color(config.rockOutlineColor) },
    },
    vertexShader: rockVertexShader,
    fragmentShader: outlineFragmentShader,
    side: THREE.BackSide,
    transparent: false,
    depthWrite: true,
    depthTest: true,
  });
}

function createDustMaterial(config: RockRippleVfxConfig, cellular: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uAge: { value: 0 },
      uLifetime: { value: config.dustLifetime },
      uCellular: { value: cellular },
      uColor: { value: new THREE.Color(config.dustColor) },
    },
    vertexShader: dustVertexShader,
    fragmentShader: dustFragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
  });
}

function createDebrisMaterial(config: RockRippleVfxConfig): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uAge: { value: 0 },
      uLifetime: { value: config.debrisLifetime },
      uShadowColor: { value: new THREE.Color(config.rockShadowColor) },
      uBaseColor: { value: new THREE.Color(config.rockBaseColor) },
      uLightColor: { value: new THREE.Color(config.rockLightColor) },
      uLightDirection: { value: new THREE.Vector3().fromArray(config.lightDirection).normalize() },
    },
    vertexShader: debrisVertexShader,
    fragmentShader: debrisFragmentShader,
    transparent: false,
    depthWrite: true,
    depthTest: true,
  });
}

function setAge(material: THREE.ShaderMaterial, age: number): void {
  material.uniforms.uAge.value = age;
}

function hash(value: number): number {
  return Math.abs(Math.sin(value * 12.9898) * 43758.5453) % 1;
}

const rockVertexShader = `
  uniform float uAge;
  uniform float uRockLifetime;
  uniform float uOutlineThickness;

  attribute float instanceDelay;
  attribute float instanceSeed;

  varying float vVisible;
  varying float vHeight;
  varying float vSeed;
  varying vec3 vWorldNormal;

  void main() {
    float localAge = uAge - instanceDelay;
    float life = clamp(localAge / max(uRockLifetime, 0.001), 0.0, 1.0);
    float rise = smoothstep(0.0, 0.06, life);
    float settle = smoothstep(0.08, 0.15, life);
    float sink = 1.0 - smoothstep(0.72, 1.0, life);
    float heightScale = rise * mix(1.0, 0.9, settle) * sink;

    float sourceHeight = clamp((position.y + 0.16) / 2.08, 0.0, 1.0);
    float leanAngle = instanceSeed * 6.2831853;
    vec2 lean = vec2(cos(leanAngle), sin(leanAngle)) * sourceHeight * 0.16;
    vec3 localPosition = position;
    localPosition.y = -0.16 + (position.y + 0.16) * heightScale;
    localPosition.xz += lean * heightScale;
    localPosition += normal * uOutlineThickness * rise * sink;

    vec4 instancePosition = instanceMatrix * vec4(localPosition, 1.0);
    vec4 worldPosition = modelMatrix * instancePosition;
    vVisible = step(0.0, localAge) * (1.0 - step(0.999, life));
    vHeight = sourceHeight;
    vSeed = instanceSeed;
    vWorldNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const rockFragmentShader = `
  uniform sampler2D uCellular;
  uniform vec3 uShadowColor;
  uniform vec3 uBaseColor;
  uniform vec3 uLightColor;
  uniform vec3 uLightDirection;

  varying float vVisible;
  varying float vHeight;
  varying float vSeed;
  varying vec3 vWorldNormal;

  void main() {
    if (vVisible < 0.5) {
      discard;
    }

    float noise = texture2D(uCellular, vec2(vHeight * 0.85 + vSeed * 2.7, vSeed * 4.3)).r;
    float diffuse = dot(normalize(vWorldNormal), normalize(uLightDirection)) * 0.5 + 0.5;
    float shadeValue = (1.0 - vHeight) * 0.7 + (noise - 0.5) * 0.34 + diffuse * 0.18;
    vec3 color = mix(uShadowColor, uBaseColor, step(0.3, shadeValue));
    color = mix(color, uLightColor, step(0.56, shadeValue));
    gl_FragColor = vec4(color, 1.0);
  }
`;

const outlineFragmentShader = `
  uniform vec3 uOutlineColor;
  varying float vVisible;

  void main() {
    if (vVisible < 0.5) {
      discard;
    }
    gl_FragColor = vec4(uOutlineColor, 1.0);
  }
`;

const dustVertexShader = `
  uniform float uAge;
  uniform float uLifetime;

  attribute float instanceDelay;
  attribute float instanceSeed;

  varying vec2 vUv;
  varying float vLife;
  varying float vVisible;
  varying float vSeed;

  void main() {
    float localAge = uAge - instanceDelay;
    float life = clamp(localAge / max(uLifetime, 0.001), 0.0, 1.0);
    float burstScale = mix(0.25, 1.18, smoothstep(0.0, 0.75, life));
    vec3 localPosition = position * burstScale;
    vec4 instancePosition = instanceMatrix * vec4(localPosition, 1.0);
    instancePosition.y += 0.032;
    vUv = uv;
    vLife = life;
    vVisible = step(0.0, localAge) * (1.0 - step(0.999, life));
    vSeed = instanceSeed;
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * instancePosition;
  }
`;

const dustFragmentShader = `
  uniform sampler2D uCellular;
  uniform vec3 uColor;

  varying vec2 vUv;
  varying float vLife;
  varying float vVisible;
  varying float vSeed;

  void main() {
    vec2 centered = vUv - 0.5;
    float radius = length(centered) * 2.0;
    float noise = texture2D(uCellular, vUv * 1.55 + vec2(vSeed * 4.3, vSeed * 6.1)).r;
    float outerEdge = 0.7 + (noise - 0.5) * 0.26;
    float innerEdge = mix(0.12, 0.43, smoothstep(0.08, 0.82, vLife));
    if (vVisible < 0.5 || radius > outerEdge || radius < innerEdge) {
      discard;
    }
    float fade = 1.0 - smoothstep(0.42, 1.0, vLife);
    vec3 color = uColor * mix(1.0, 0.62, vLife) * mix(0.82, 1.06, step(0.52, noise));
    gl_FragColor = vec4(color, fade * 0.38);
  }
`;

const debrisVertexShader = `
  uniform float uAge;
  uniform float uLifetime;

  attribute float instanceDelay;
  attribute float instanceSeed;
  attribute vec3 instanceDirection;

  varying float vVisible;
  varying float vShade;
  varying vec3 vWorldNormal;

  void main() {
    float localAge = uAge - instanceDelay;
    float life = clamp(localAge / max(uLifetime, 0.001), 0.0, 1.0);
    vec4 instancePosition = instanceMatrix * vec4(position, 1.0);
    instancePosition.xz += instanceDirection.xz * life;
    instancePosition.y += sin(life * 3.14159265) * instanceDirection.y;
    vec4 worldPosition = modelMatrix * instancePosition;
    vVisible = step(0.0, localAge) * (1.0 - step(0.999, life));
    vShade = instanceSeed;
    vWorldNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const debrisFragmentShader = `
  uniform vec3 uShadowColor;
  uniform vec3 uBaseColor;
  uniform vec3 uLightColor;
  uniform vec3 uLightDirection;

  varying float vVisible;
  varying float vShade;
  varying vec3 vWorldNormal;

  void main() {
    if (vVisible < 0.5) {
      discard;
    }
    float diffuse = dot(normalize(vWorldNormal), normalize(uLightDirection)) * 0.5 + 0.5;
    float shade = diffuse + (vShade - 0.5) * 0.18;
    vec3 color = mix(uShadowColor, uBaseColor, step(0.38, shade));
    color = mix(color, uLightColor, step(0.72, shade));
    gl_FragColor = vec4(color, 1.0);
  }
`;
