import * as THREE from "three";

const textureBase = `${import.meta.env.BASE_URL}assets/vfx/smoke/`;
const cloudCount = 15;
const inactiveBirthTime = -1000;

type SmokeTextures = {
  cloudNoise: THREE.Texture;
  cloudDetail: THREE.Texture;
  dissolve: THREE.Texture;
};

type CloudGeometryData = {
  geometry: THREE.SphereGeometry;
  origins: THREE.InstancedBufferAttribute;
  velocities: THREE.InstancedBufferAttribute;
  scaleRanges: THREE.InstancedBufferAttribute;
  birthTimes: THREE.InstancedBufferAttribute;
  lifetimes: THREE.InstancedBufferAttribute;
  seeds: THREE.InstancedBufferAttribute;
};

const identityMatrix = new THREE.Matrix4();
const smokeHighlight = new THREE.Color("#ffffff");

export class SmokeVfx {
  readonly group = new THREE.Group();

  private readonly textures: SmokeTextures;
  private readonly cloudMaterial: THREE.ShaderMaterial;
  private readonly outlineMaterial: THREE.ShaderMaterial;
  private readonly cloudMesh: THREE.InstancedMesh;
  private readonly outlineMesh: THREE.InstancedMesh;
  private readonly origins: THREE.InstancedBufferAttribute;
  private readonly velocities: THREE.InstancedBufferAttribute;
  private readonly scaleRanges: THREE.InstancedBufferAttribute;
  private readonly birthTimes: THREE.InstancedBufferAttribute;
  private readonly lifetimes: THREE.InstancedBufferAttribute;
  private readonly seeds: THREE.InstancedBufferAttribute;
  private readonly bounds = new THREE.Box3();
  private readonly sphere = new THREE.Sphere();
  private readonly paintColor = new THREE.Color();
  private reducedMotion = false;
  private spawnSequence = 0;

  constructor() {
    this.group.name = "Smoke VFX";
    this.group.visible = false;
    this.textures = loadTextures();

    const geometryData = createCloudGeometry();
    this.origins = geometryData.origins;
    this.velocities = geometryData.velocities;
    this.scaleRanges = geometryData.scaleRanges;
    this.birthTimes = geometryData.birthTimes;
    this.lifetimes = geometryData.lifetimes;
    this.seeds = geometryData.seeds;
    this.cloudMaterial = createCloudMaterial(this.textures, false);
    this.outlineMaterial = createCloudMaterial(this.textures, true);

    this.cloudMesh = new THREE.InstancedMesh(geometryData.geometry, this.cloudMaterial, cloudCount);
    this.cloudMesh.name = "Smoke Puffs";
    this.cloudMesh.frustumCulled = false;
    this.cloudMesh.renderOrder = 4;

    this.outlineMesh = new THREE.InstancedMesh(geometryData.geometry, this.outlineMaterial, cloudCount);
    this.outlineMesh.name = "Smoke Outline";
    this.outlineMesh.frustumCulled = false;
    this.outlineMesh.renderOrder = 3;

    for (let index = 0; index < cloudCount; index += 1) {
      this.cloudMesh.setMatrixAt(index, identityMatrix);
      this.outlineMesh.setMatrixAt(index, identityMatrix);
    }
    this.cloudMesh.instanceMatrix.needsUpdate = true;
    this.outlineMesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.outlineMesh, this.cloudMesh);
  }

  emit(
    target: THREE.Object3D,
    elapsedTime: number,
    reducedMotion = false,
    color?: THREE.ColorRepresentation,
  ): void {
    if (color !== undefined) this.setPalette(color);
    this.reducedMotion = reducedMotion;
    this.cloudMaterial.uniforms.uTime.value = elapsedTime;
    this.outlineMaterial.uniforms.uTime.value = elapsedTime;
    this.emitBurst(target, elapsedTime);
    this.group.visible = true;
  }

  update(_deltaTime: number, elapsedTime: number): void {
    this.cloudMaterial.uniforms.uTime.value = elapsedTime;
    this.outlineMaterial.uniforms.uTime.value = elapsedTime;
    this.group.visible = this.hasLivingParticles(elapsedTime);
  }

  dispose(): void {
    this.cloudMesh.geometry.dispose();
    this.cloudMaterial.dispose();
    this.outlineMaterial.dispose();
    this.textures.cloudNoise.dispose();
    this.textures.cloudDetail.dispose();
    this.textures.dissolve.dispose();
  }

  private setPalette(color: THREE.ColorRepresentation): void {
    this.paintColor.set(color);
    this.cloudMaterial.uniforms.uShadowColor.value.copy(this.paintColor).multiplyScalar(0.34);
    this.cloudMaterial.uniforms.uMidColor.value.copy(this.paintColor).lerp(smokeHighlight, 0.12);
    this.cloudMaterial.uniforms.uLightColor.value.copy(this.paintColor).lerp(smokeHighlight, 0.28);
  }

  private emitBurst(target: THREE.Object3D, birthTime: number): void {
    target.updateWorldMatrix(true, true);
    this.bounds.setFromObject(target);
    if (this.bounds.isEmpty()) {
      return;
    }
    this.bounds.getBoundingSphere(this.sphere);

    const radius = Math.max(this.sphere.radius, 0.25);
    for (let slot = 0; slot < cloudCount; slot += 1) {
      this.emitPuff(slot, birthTime, radius);
    }

    this.origins.needsUpdate = true;
    this.velocities.needsUpdate = true;
    this.scaleRanges.needsUpdate = true;
    this.birthTimes.needsUpdate = true;
    this.lifetimes.needsUpdate = true;
    this.seeds.needsUpdate = true;
  }

  private emitPuff(slot: number, birthTime: number, radius: number): void {
    const sequence = this.spawnSequence;
    this.spawnSequence += 1;

    const angle = seededRandom(sequence, 1) * Math.PI * 2;
    const radialDistance = Math.sqrt(seededRandom(sequence, 2)) * radius * 0.14;
    const originX = this.sphere.center.x + Math.cos(angle) * radialDistance;
    const originY =
      this.sphere.center.y + (seededRandom(sequence, 3) - 0.5) * radius * 0.16;
    const originZ = this.sphere.center.z + Math.sin(angle) * radialDistance;

    const driftAngle = angle + (seededRandom(sequence, 4) - 0.5) * 0.9;
    const horizontalSpeed = this.reducedMotion
      ? 0
      : radius * THREE.MathUtils.lerp(0.16, 0.28, seededRandom(sequence, 5));
    const verticalSpeed = this.reducedMotion
      ? 0
      : radius * THREE.MathUtils.lerp(0.22, 0.4, seededRandom(sequence, 6));
    const lifetime = this.reducedMotion
      ? THREE.MathUtils.lerp(0.22, 0.26, seededRandom(sequence, 7))
      : THREE.MathUtils.lerp(0.36, 0.44, seededRandom(sequence, 7));
    const startScale = radius * THREE.MathUtils.lerp(0.07, 0.1, seededRandom(sequence, 8));
    const fullEndScale = radius * THREE.MathUtils.lerp(0.28, 0.4, seededRandom(sequence, 9));
    const endScale = this.reducedMotion
      ? THREE.MathUtils.lerp(startScale, fullEndScale, 0.86)
      : fullEndScale;

    this.origins.setXYZ(slot, originX, originY, originZ);
    this.velocities.setXYZ(
      slot,
      Math.cos(driftAngle) * horizontalSpeed,
      verticalSpeed,
      Math.sin(driftAngle) * horizontalSpeed,
    );
    this.scaleRanges.setXY(slot, startScale, endScale);
    this.birthTimes.setX(slot, birthTime);
    this.lifetimes.setX(slot, lifetime);
    this.seeds.setX(slot, seededRandom(sequence, 10));
  }

  private hasLivingParticles(elapsedTime: number): boolean {
    for (let index = 0; index < cloudCount; index += 1) {
      const birthTime = this.birthTimes.getX(index);
      if (birthTime > inactiveBirthTime && elapsedTime < birthTime + this.lifetimes.getX(index)) {
        return true;
      }
    }
    return false;
  }
}

function loadTextures(): SmokeTextures {
  const loader = new THREE.TextureLoader();
  const cloudNoise = loader.load(`${textureBase}T_VFX_Noise41.webp`);
  const cloudDetail = loader.load(`${textureBase}T_PerlinNoise_Tiled.webp`);
  const dissolve = loader.load(`${textureBase}T_VFX_exp_dissapear.webp`);

  for (const texture of [cloudNoise, cloudDetail, dissolve]) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.NoColorSpace;
    texture.needsUpdate = true;
  }

  return { cloudNoise, cloudDetail, dissolve };
}

function createCloudGeometry(): CloudGeometryData {
  const geometry = new THREE.SphereGeometry(1, 18, 12);
  const origins = dynamicAttribute(new Float32Array(cloudCount * 3), 3);
  const velocities = dynamicAttribute(new Float32Array(cloudCount * 3), 3);
  const scaleRanges = dynamicAttribute(new Float32Array(cloudCount * 2), 2);
  const birthTimes = dynamicAttribute(new Float32Array(cloudCount).fill(inactiveBirthTime), 1);
  const lifetimes = dynamicAttribute(new Float32Array(cloudCount), 1);
  const seeds = dynamicAttribute(new Float32Array(cloudCount), 1);

  geometry.setAttribute("instanceOrigin", origins);
  geometry.setAttribute("instanceVelocity", velocities);
  geometry.setAttribute("instanceScaleRange", scaleRanges);
  geometry.setAttribute("instanceBirthTime", birthTimes);
  geometry.setAttribute("instanceLifetime", lifetimes);
  geometry.setAttribute("instanceSeed", seeds);
  return { geometry, origins, velocities, scaleRanges, birthTimes, lifetimes, seeds };
}

function dynamicAttribute(array: Float32Array, itemSize: number): THREE.InstancedBufferAttribute {
  const attribute = new THREE.InstancedBufferAttribute(array, itemSize);
  attribute.setUsage(THREE.DynamicDrawUsage);
  return attribute;
}

function createCloudMaterial(textures: SmokeTextures, outline: boolean): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uNoiseTex: { value: textures.cloudNoise },
      uDetailTex: { value: textures.cloudDetail },
      uDissolveTex: { value: textures.dissolve },
      uShadowColor: { value: new THREE.Color("#34536e") },
      uMidColor: { value: new THREE.Color("#7fb8d5") },
      uLightColor: { value: new THREE.Color("#dffaff") },
      uOutlineColor: { value: new THREE.Color("#05090d") },
      uOutlineThickness: { value: outline ? 0.11 : 0 },
    },
    vertexShader: cloudVertexShader,
    fragmentShader: outline ? cloudOutlineFragmentShader : cloudFragmentShader,
    side: outline ? THREE.BackSide : THREE.FrontSide,
    transparent: false,
    depthWrite: true,
    depthTest: true,
  });
}

function seededRandom(index: number, channel: number): number {
  return THREE.MathUtils.seededRandom(719 + index * 97 + channel * 131);
}

const cloudVertexShader = `
  uniform float uTime;
  uniform float uOutlineThickness;
  uniform sampler2D uNoiseTex;

  attribute vec3 instanceOrigin;
  attribute vec3 instanceVelocity;
  attribute vec2 instanceScaleRange;
  attribute float instanceBirthTime;
  attribute float instanceLifetime;
  attribute float instanceSeed;

  varying vec2 vNoiseUvA;
  varying vec2 vNoiseUvB;
  varying float vLocalHeight;
  varying float vLife;

  void main() {
    float age = uTime - instanceBirthTime;
    float life = age / max(instanceLifetime, 0.001);
    float appearDuration = mix(0.025, 0.04, instanceSeed);
    float appear = age >= 0.0 ? smoothstep(0.0, appearDuration, age) : 0.0;
    float growth = smoothstep(0.0, 0.27, clamp(life, 0.0, 1.0));
    float scale = mix(instanceScaleRange.x, instanceScaleRange.y, growth) * appear;

    vec3 center = instanceOrigin + instanceVelocity * max(age, 0.0);
    float sway = sin(age * 2.1 + instanceSeed * 6.28318) * instanceScaleRange.y * 0.07;
    center.x += sway;
    center.z += cos(age * 1.7 + instanceSeed * 5.17) * instanceScaleRange.y * 0.05;

    vec2 pan = vec2(age * 0.055, -age * 0.041);
    vNoiseUvA = position.xz * 0.82 + pan + instanceSeed * 3.7;
    vNoiseUvB = position.xy * 0.82 + pan.yx - instanceSeed * 2.9;
    float noiseA = texture2D(uNoiseTex, vNoiseUvA).r;
    float noiseB = texture2D(uNoiseTex, vNoiseUvB).r;
    float deformation = (mix(noiseA, noiseB, 0.38) - 0.5) * 0.3 * scale;

    vec3 local = position * scale + center;
    local += normal * deformation;
    local += normal * uOutlineThickness * scale * appear;

    vec4 worldPosition = modelMatrix * instanceMatrix * vec4(local, 1.0);
    vLocalHeight = position.y;
    vLife = life;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const cloudFragmentPreamble = `
  uniform sampler2D uNoiseTex;
  uniform sampler2D uDetailTex;
  uniform sampler2D uDissolveTex;
  varying vec2 vNoiseUvA;
  varying vec2 vNoiseUvB;
  varying float vLocalHeight;
  varying float vLife;

  float dissolveField() {
    float noise = mix(texture2D(uNoiseTex, vNoiseUvA).r, texture2D(uNoiseTex, vNoiseUvB).r, 0.38);
    float detail = mix(texture2D(uDetailTex, vNoiseUvA * 1.7).r, texture2D(uDetailTex, vNoiseUvB * 1.7).r, 0.38);
    return noise * 0.68 + detail * 0.32;
  }

  void clipCloud(float field) {
    if (vLife < 0.0 || vLife >= 1.0) {
      discard;
    }
    float dissolve = mix(texture2D(uDissolveTex, vNoiseUvA * 0.9).r, texture2D(uDissolveTex, vNoiseUvB * 0.9).r, 0.38);
    float fade = smoothstep(0.45, 1.0, vLife);
    float threshold = mix(-0.18, 1.02, fade);
    if (dissolve * 0.62 + field * 0.38 < threshold) {
      discard;
    }
  }
`;

const cloudFragmentShader = `
  ${cloudFragmentPreamble}
  uniform vec3 uShadowColor;
  uniform vec3 uMidColor;
  uniform vec3 uLightColor;

  void main() {
    float field = dissolveField();
    clipCloud(field);
    float paletteLife = smoothstep(0.08, 0.82, clamp(vLife, 0.0, 1.0));
    vec3 shadowColor = mix(uShadowColor, uMidColor, paletteLife);
    vec3 bodyColor = mix(uMidColor, uLightColor, paletteLife);
    vec3 color = mix(shadowColor, bodyColor, step(-0.15, vLocalHeight));
    gl_FragColor = vec4(color, 1.0);
  }
`;

const cloudOutlineFragmentShader = `
  ${cloudFragmentPreamble}
  uniform vec3 uOutlineColor;

  void main() {
    float field = dissolveField();
    clipCloud(field);
    gl_FragColor = vec4(uOutlineColor, 1.0);
  }
`;
