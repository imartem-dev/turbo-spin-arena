import * as THREE from "three";

export type HitTargetVfxConfig = {
  poolSize: number;
  duration: number;
  maxRadius: number;
  color: string;
  hotColor: string;
  intensity: number;
};

type SharedUniforms = {
  uTime: { value: number };
  uDuration: { value: number };
  uMaxRadius: { value: number };
  uColor: { value: THREE.Color };
  uHotColor: { value: THREE.Color };
  uIntensity: { value: number };
};

const inactiveStartTime = -10_000;
const reducedMotionDuration = 0.18;
const scratchMatrix = new THREE.Matrix4();

export const defaultHitTargetVfxConfig: HitTargetVfxConfig = {
  poolSize: 10,
  duration: 0.54,
  maxRadius: 2,
  color: "#fced65",
  hotColor: "#ffffff",
  intensity: 1,
};

export class HitTargetVfxPool {
  readonly group = new THREE.Group();

  private readonly config: HitTargetVfxConfig;
  private readonly geometry: THREE.PlaneGeometry;
  private readonly material: THREE.ShaderMaterial;
  private readonly mesh: THREE.InstancedMesh;
  private readonly startTimes: THREE.InstancedBufferAttribute;
  private readonly impactDirections: THREE.InstancedBufferAttribute;
  private readonly seeds: THREE.InstancedBufferAttribute;
  private readonly reducedMotion: THREE.InstancedBufferAttribute;
  private readonly uniforms: SharedUniforms;
  private time = 0;
  private nextSlot = 0;
  private disposed = false;

  constructor(config: Partial<HitTargetVfxConfig> = {}) {
    this.config = normalizeConfig(config);
    this.group.name = "VFX_Hit_TARGET Pool";

    const attributes = createGeometry(this.config.poolSize);
    this.geometry = attributes.geometry;
    this.startTimes = attributes.startTimes;
    this.impactDirections = attributes.impactDirections;
    this.seeds = attributes.seeds;
    this.reducedMotion = attributes.reducedMotion;

    this.uniforms = {
      uTime: { value: 0 },
      uDuration: { value: this.config.duration },
      uMaxRadius: { value: this.config.maxRadius },
      uColor: { value: new THREE.Color(this.config.color) },
      uHotColor: { value: new THREE.Color(this.config.hotColor) },
      uIntensity: { value: this.config.intensity },
    };
    this.material = createMaterial(this.uniforms);
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, this.config.poolSize);
    this.mesh.name = "VFX_Hit_TARGET Flashes";
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 8;
    initializeInstanceMatrices(this.mesh, this.config.poolSize);
    this.group.add(this.mesh);
  }

  spawn(position: THREE.Vector3, direction: THREE.Vector3, reducedMotion = false): void {
    if (this.disposed) {
      return;
    }

    const slot = this.nextSlot;
    this.nextSlot = (this.nextSlot + 1) % this.config.poolSize;

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
    this.mesh.setMatrixAt(slot, scratchMatrix);
    this.startTimes.setX(slot, this.time);
    this.impactDirections.setXYZ(slot, directionX, 0, directionZ);
    this.seeds.setX(slot, Math.random() * 1_000);
    this.reducedMotion.setX(slot, reducedMotion ? 1 : 0);

    this.mesh.instanceMatrix.needsUpdate = true;
    this.startTimes.needsUpdate = true;
    this.impactDirections.needsUpdate = true;
    this.seeds.needsUpdate = true;
    this.reducedMotion.needsUpdate = true;
  }

  update(deltaTime: number): void {
    if (this.disposed) {
      return;
    }
    this.time += Math.max(0, deltaTime);
    this.uniforms.uTime.value = this.time;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.geometry.dispose();
    this.material.dispose();
    this.group.clear();
  }
}

function normalizeConfig(config: Partial<HitTargetVfxConfig>): HitTargetVfxConfig {
  return {
    ...defaultHitTargetVfxConfig,
    ...config,
    poolSize: Math.max(1, Math.floor(config.poolSize ?? defaultHitTargetVfxConfig.poolSize)),
    duration: Math.max(0.05, config.duration ?? defaultHitTargetVfxConfig.duration),
    maxRadius: Math.max(0.05, config.maxRadius ?? defaultHitTargetVfxConfig.maxRadius),
    intensity: Math.max(0, config.intensity ?? defaultHitTargetVfxConfig.intensity),
  };
}

function createGeometry(count: number): {
  geometry: THREE.PlaneGeometry;
  startTimes: THREE.InstancedBufferAttribute;
  impactDirections: THREE.InstancedBufferAttribute;
  seeds: THREE.InstancedBufferAttribute;
  reducedMotion: THREE.InstancedBufferAttribute;
} {
  const geometry = new THREE.PlaneGeometry(1, 1);
  const startTimes = createInstancedAttribute(count, 1, inactiveStartTime);
  const impactDirections = createInstancedAttribute(count, 3, 0);
  const seeds = createInstancedAttribute(count, 1, 0);
  const reducedMotion = createInstancedAttribute(count, 1, 0);
  geometry.setAttribute("aStartTime", startTimes);
  geometry.setAttribute("aImpactDirection", impactDirections);
  geometry.setAttribute("aSeed", seeds);
  geometry.setAttribute("aReducedMotion", reducedMotion);
  return { geometry, startTimes, impactDirections, seeds, reducedMotion };
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

function createMaterial(uniforms: SharedUniforms): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      attribute float aStartTime;
      attribute vec3 aImpactDirection;
      attribute float aSeed;
      attribute float aReducedMotion;
      uniform float uTime;
      uniform float uDuration;
      uniform float uMaxRadius;
      varying vec2 vUv;
      varying vec2 vImpactDirection;
      varying float vAge;
      varying float vSeed;
      varying float vReducedMotion;

      void main() {
        float age = (uTime - aStartTime) / uDuration;
        float motionScale = mix(1.0, 0.62, aReducedMotion);
        vec2 offset = position.xy * uMaxRadius * 2.0 * motionScale;
        vec3 center = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vec3 cameraRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 cameraUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        vec3 worldPosition = center + cameraRight * offset.x + cameraUp * offset.y;
        vec2 projectedDirection = vec2(
          dot(aImpactDirection, cameraRight),
          dot(aImpactDirection, cameraUp)
        );
        if (dot(projectedDirection, projectedDirection) < 0.0001) {
          projectedDirection = vec2(1.0, 0.0);
        }

        gl_Position = projectionMatrix * viewMatrix * vec4(worldPosition, 1.0);
        vUv = uv;
        vImpactDirection = normalize(projectedDirection);
        vAge = age;
        vSeed = aSeed;
        vReducedMotion = aReducedMotion;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform vec3 uHotColor;
      uniform float uIntensity;
      uniform float uDuration;
      varying vec2 vUv;
      varying vec2 vImpactDirection;
      varying float vAge;
      varying float vSeed;
      varying float vReducedMotion;

      const float PI = 3.14159265359;

      float hash11(float value) {
        return fract(sin(value * 127.1) * 43758.5453123);
      }

      float hash21(vec2 value) {
        return fract(sin(dot(value, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float valueNoise(vec2 point) {
        vec2 cell = floor(point);
        vec2 local = fract(point);
        local = local * local * (3.0 - 2.0 * local);
        float bottom = mix(hash21(cell), hash21(cell + vec2(1.0, 0.0)), local.x);
        float top = mix(hash21(cell + vec2(0.0, 1.0)), hash21(cell + vec2(1.0)), local.x);
        return mix(bottom, top, local.y);
      }

      float angularNoise(float angle, float seed) {
        float phaseA = hash11(seed + 2.13) * PI * 2.0;
        float phaseB = hash11(seed + 9.71) * PI * 2.0;
        float phaseC = hash11(seed + 17.43) * PI * 2.0;
        return sin(angle * 3.0 + phaseA) * 0.54
          + sin(angle * 7.0 + phaseB) * 0.3
          + sin(angle * 13.0 + phaseC) * 0.16;
      }

      vec2 rotateVector(vec2 value, float angle) {
        float sine = sin(angle);
        float cosine = cos(angle);
        return vec2(
          value.x * cosine - value.y * sine,
          value.x * sine + value.y * cosine
        );
      }

      float bladeSdf(
        vec2 point,
        vec2 origin,
        vec2 direction,
        float length,
        float halfWidth,
        float bend,
        float noiseSeed
      ) {
        vec2 tangent = vec2(-direction.y, direction.x);
        vec2 relative = point - origin;
        float along = dot(relative, direction);
        float across = dot(relative, tangent);
        float safeLength = max(length, 0.0001);
        float progress = clamp(along / safeLength, 0.0, 1.0);
        across -= bend * progress * progress * safeLength;
        float profileExponent = mix(1.18, 1.72, hash11(noiseSeed + 0.37));
        float width = halfWidth * pow(max(0.0, 1.0 - progress), profileExponent);
        float edgeNoise = (valueNoise(point * 8.0 + noiseSeed) - 0.5)
          * mix(0.009, 0.017, hash11(noiseSeed + 4.81))
          * (1.0 - smoothstep(0.68, 1.0, progress));
        float side = abs(across) - max(0.0, width + edgeNoise);
        float cap = max(-along, along - safeLength);
        vec2 boundaryDistance = vec2(side, cap);
        vec2 outsideDistance = max(boundaryDistance, vec2(0.0));
        return min(max(boundaryDistance.x, boundaryDistance.y), 0.0)
          + sqrt(dot(outsideDistance, outsideDistance));
      }

      float hardMask(float sdf) {
        return 1.0 - smoothstep(-0.008, 0.008, sdf);
      }

      float outerGlow(float sdf, float reach) {
        return 1.0 - smoothstep(0.0, reach, max(sdf, 0.0));
      }

      void main() {
        float reducedEndAge = ${reducedMotionDuration.toFixed(2)} / uDuration;
        float endAge = mix(1.0, reducedEndAge, vReducedMotion);
        if (vAge < 0.0 || vAge > endAge) {
          discard;
        }

        vec2 point = (vUv - 0.5) * 2.0;
        vec2 impactDirection = normalize(vImpactDirection);
        float ageSeconds = vAge * uDuration;
        float radius = length(point);
        float angle = atan(point.y, point.x);

        float collapse = smoothstep(0.0, 0.12, ageSeconds);
        float outerRadius = mix(0.54, 0.18, collapse);
        float innerCollapse = smoothstep(0.0, 0.075, ageSeconds);
        float innerRadius = mix(0.39, 0.0, innerCollapse);
        float outerVariation = angularNoise(angle, vSeed + 1.7)
          * mix(0.048, 0.007, collapse);
        vec2 innerCenter = -impactDirection * mix(0.135, 0.025, collapse);
        vec2 innerPoint = point - innerCenter;
        float innerAngle = atan(innerPoint.y, innerPoint.x);
        float innerVariation = angularNoise(innerAngle, vSeed + 14.2)
          * 0.028
          * (1.0 - innerCollapse);
        float outerSdf = radius - (outerRadius + outerVariation);
        float innerSdf = length(innerPoint) - max(0.0, innerRadius + innerVariation);
        float collapseSdf = max(outerSdf, -innerSdf);
        collapseSdf = mix(
          collapseSdf,
          outerSdf,
          1.0 - smoothstep(0.0, 0.006, innerRadius)
        );

        float collapseBladeScale = mix(1.0, 0.52, collapse);
        vec2 collapseDirectionA = rotateVector(impactDirection, 0.08);
        vec2 collapseDirectionB = rotateVector(impactDirection, 2.18 + (hash11(vSeed + 4.2) - 0.5) * 0.22);
        vec2 collapseDirectionC = rotateVector(impactDirection, -2.02 + (hash11(vSeed + 7.9) - 0.5) * 0.22);
        collapseSdf = min(collapseSdf, bladeSdf(
          point,
          collapseDirectionA * outerRadius * 0.88,
          collapseDirectionA,
          0.28 * collapseBladeScale,
          0.076 * collapseBladeScale,
          0.04,
          vSeed + 3.0
        ));
        collapseSdf = min(collapseSdf, bladeSdf(
          point,
          collapseDirectionB * outerRadius * 0.88,
          collapseDirectionB,
          0.22 * collapseBladeScale,
          0.068 * collapseBladeScale,
          -0.035,
          vSeed + 8.0
        ));
        collapseSdf = min(collapseSdf, bladeSdf(
          point,
          collapseDirectionC * outerRadius * 0.88,
          collapseDirectionC,
          0.2 * collapseBladeScale,
          0.062 * collapseBladeScale,
          0.03,
          vSeed + 12.0
        ));

        float collapsePop = smoothstep(0.0, 0.008, ageSeconds);
        float normalCollapseLife = collapsePop * (1.0 - smoothstep(0.115, 0.145, ageSeconds));
        float reducedProgress = clamp(vAge / max(reducedEndAge, 0.0001), 0.0, 1.0);
        float reducedLife = smoothstep(0.0, 0.12, reducedProgress)
          * (1.0 - smoothstep(0.45, 1.0, reducedProgress));
        float collapseLife = mix(normalCollapseLife, reducedLife, vReducedMotion);
        float collapseMask = hardMask(collapseSdf) * collapseLife;
        float collapseGlow = outerGlow(collapseSdf, 0.11) * collapseLife;

        float blastEnabled = 1.0 - vReducedMotion;
        float blastProgress = clamp((ageSeconds - 0.19) / 0.15, 0.0, 1.0);
        float blastReveal = smoothstep(0.19, 0.205, ageSeconds);
        float blastDecay = smoothstep(0.34, 0.64, ageSeconds);
        float blastLife = blastEnabled * blastReveal * (1.0 - blastDecay);
        float coreRadius = mix(0.15, 0.3, smoothstep(0.0, 0.72, blastProgress));
        coreRadius *= mix(1.0, 0.84, blastDecay);
        float coreNoise = angularNoise(angle, vSeed + 31.0)
          * mix(0.018, 0.038, blastProgress);
        float coreSdf = radius - (coreRadius + coreNoise);

        float cavityReveal = smoothstep(0.235, 0.285, ageSeconds);
        float cavityRadius = mix(0.018, 0.205, cavityReveal);
        float cavityNoise = angularNoise(angle, vSeed + 47.0) * 0.026 * cavityReveal;
        float cavitySdf = radius - max(0.0, cavityRadius + cavityNoise);
        coreSdf = max(coreSdf, -cavitySdf);

        float petalWindow = smoothstep(0.215, 0.228, ageSeconds)
          * (1.0 - smoothstep(0.255, 0.28, ageSeconds));
        float petalSdf = 10.0;
        for (int petalIndex = 0; petalIndex < 4; petalIndex += 1) {
          float petalAngle = float(petalIndex) * PI * 0.5 + hash11(vSeed + 52.0) * 0.4;
          vec2 petalCenter = rotateVector(impactDirection, petalAngle) * 0.068;
          petalSdf = min(petalSdf, length(point - petalCenter) - 0.038);
        }
        coreSdf = max(coreSdf, -petalSdf * petalWindow - (1.0 - petalWindow) * 10.0);

        float bladeReveal = smoothstep(0.205, 0.285, ageSeconds);
        float bladeRetreat = mix(1.0, 0.72, blastDecay);
        float layoutSeed = hash11(vSeed + 59.0);
        float spearLayout = 1.0 - step(0.333, layoutSeed);
        float forkLayout = step(0.666, layoutSeed);
        float slashLayout = 1.0 - spearLayout - forkLayout;
        float slashSide = step(0.5, hash11(vSeed + 59.7));

        float mainAngle = (hash11(vSeed + 61.0) - 0.5)
          * (spearLayout * 0.1 + slashLayout * 0.32 + forkLayout * 0.2);
        float sideAngleA = spearLayout * 0.58 + slashLayout * 0.32 + forkLayout * 0.4
          + hash11(vSeed + 62.0) * 0.2;
        float sideAngleB = -(spearLayout * 0.52 + slashLayout * 0.36 + forkLayout * 0.44
          + hash11(vSeed + 63.0) * 0.22);
        vec2 mainDirection = rotateVector(impactDirection, mainAngle);
        vec2 sideDirectionA = rotateVector(impactDirection, sideAngleA);
        vec2 sideDirectionB = rotateVector(impactDirection, sideAngleB);
        vec2 upperBreakDirection = rotateVector(
          impactDirection,
          0.86 + hash11(vSeed + 64.0) * 0.92
        );
        vec2 backBreakDirection = rotateVector(
          impactDirection,
          -1.9 - hash11(vSeed + 65.0) * 0.82
        );

        float mainLength = (spearLayout * 0.92 + slashLayout * 0.8 + forkLayout * 0.64)
          * mix(0.86, 1.14, hash11(vSeed + 66.0));
        float mainWidth = (spearLayout * 0.13 + slashLayout * 0.17 + forkLayout * 0.115)
          * mix(0.82, 1.14, hash11(vSeed + 67.0));
        float sideLengthA = (spearLayout * 0.34 + slashLayout * 0.62 + forkLayout * 0.7)
          * mix(0.82, 1.16, hash11(vSeed + 68.0));
        float sideLengthB = (spearLayout * 0.28 + slashLayout * 0.56 + forkLayout * 0.66)
          * mix(0.8, 1.18, hash11(vSeed + 69.0));
        float sideEnableA = max(spearLayout, max(forkLayout, slashLayout * slashSide));
        float sideEnableB = max(spearLayout, max(forkLayout, slashLayout * (1.0 - slashSide)));
        float upperEnable = step(0.34, hash11(vSeed + 69.4));
        float backEnable = step(0.58, hash11(vSeed + 69.8));

        float bladeUnionSdf = 10.0;
        bladeUnionSdf = min(bladeUnionSdf, bladeSdf(
          point,
          mainDirection * coreRadius * 0.58,
          mainDirection,
          mainLength * bladeReveal * bladeRetreat,
          mainWidth * mix(0.45, 1.0, bladeReveal) * (1.0 - blastDecay * 0.5),
          0.0,
          vSeed + 71.0
        ));
        float sideBladeA = bladeSdf(
          point,
          sideDirectionA * coreRadius * 0.68,
          sideDirectionA,
          sideLengthA * bladeReveal * bladeRetreat,
          mix(0.062, 0.1, hash11(vSeed + 73.0)) * (1.0 - blastDecay * 0.48),
          0.0,
          vSeed + 74.0
        );
        bladeUnionSdf = min(bladeUnionSdf, mix(10.0, sideBladeA, sideEnableA));
        float sideBladeB = bladeSdf(
          point,
          sideDirectionB * coreRadius * 0.7,
          sideDirectionB,
          sideLengthB * bladeReveal * bladeRetreat,
          mix(0.058, 0.096, hash11(vSeed + 75.0)) * (1.0 - blastDecay * 0.48),
          0.0,
          vSeed + 76.0
        );
        bladeUnionSdf = min(bladeUnionSdf, mix(10.0, sideBladeB, sideEnableB));
        float upperBlade = bladeSdf(
          point,
          upperBreakDirection * coreRadius * 0.74,
          upperBreakDirection,
          mix(0.16, 0.34, hash11(vSeed + 77.0)) * bladeReveal * bladeRetreat,
          mix(0.034, 0.064, hash11(vSeed + 77.5)) * (1.0 - blastDecay * 0.55),
          0.0,
          vSeed + 78.0
        );
        bladeUnionSdf = min(bladeUnionSdf, mix(10.0, upperBlade, upperEnable));
        float backBlade = bladeSdf(
          point,
          backBreakDirection * coreRadius * 0.72,
          backBreakDirection,
          mix(0.13, 0.3, hash11(vSeed + 79.0)) * bladeReveal * bladeRetreat,
          mix(0.03, 0.058, hash11(vSeed + 79.5)) * (1.0 - blastDecay * 0.55),
          0.0,
          vSeed + 80.0
        );
        bladeUnionSdf = min(bladeUnionSdf, mix(10.0, backBlade, backEnable));

        float tearWidth = mix(0.008, 0.072, smoothstep(0.265, 0.5, ageSeconds));
        vec2 tearDirectionA = rotateVector(impactDirection, 2.62 + hash11(vSeed + 83.0) * 0.28);
        vec2 tearDirectionB = rotateVector(impactDirection, -1.62 - hash11(vSeed + 84.0) * 0.32);
        vec2 tearDirectionC = rotateVector(impactDirection, 0.72 + hash11(vSeed + 84.5) * 0.28);
        float tearA = bladeSdf(point, vec2(0.0), tearDirectionA, 0.42, tearWidth, 0.02, vSeed + 85.0);
        float tearB = bladeSdf(point, vec2(0.0), tearDirectionB, 0.4, tearWidth * 0.8, -0.02, vSeed + 86.0);
        float tearC = bladeSdf(point, vec2(0.0), tearDirectionC, 0.44, tearWidth * 1.1, 0.025, vSeed + 87.0);
        coreSdf = max(coreSdf, -min(tearA, min(tearB, tearC)));

        float shardTravel = smoothstep(0.255, 0.52, ageSeconds);
        float shardCount = floor(5.0 + hash11(vSeed + 90.5) * 3.0);
        float shardSdf = 10.0;
        for (int shardIndex = 0; shardIndex < 7; shardIndex += 1) {
          float shardId = float(shardIndex);
          float shardEnabled = 1.0 - step(shardCount, shardId + 0.5);
          float shardSeed = vSeed + 91.0 + shardId * 7.13;
          float shardAngle = (hash11(shardSeed) - 0.5) * PI * 1.8;
          vec2 shardDirection = rotateVector(impactDirection, shardAngle);
          float shardDistance = mix(0.38, 0.7, shardTravel)
            * mix(0.84, 1.14, hash11(shardSeed + 1.7));
          float shardLength = mix(0.055, 0.12, hash11(shardSeed + 2.9))
            * (1.0 - blastDecay * 0.58);
          float shardWidth = mix(0.009, 0.018, hash11(shardSeed + 4.1))
            * (1.0 - blastDecay * 0.66);
          float shardBlade = bladeSdf(
            point,
            shardDirection * shardDistance,
            shardDirection,
            shardLength,
            shardWidth,
            0.0,
            shardSeed + 6.5
          );
          shardSdf = min(shardSdf, mix(10.0, shardBlade, shardEnabled));
        }
        float shardLife = blastEnabled
          * smoothstep(0.255, 0.3, ageSeconds)
          * (1.0 - smoothstep(0.47, 0.62, ageSeconds));

        float fragmentGate = smoothstep(
          -0.02,
          0.22,
          angularNoise(angle, vSeed + 104.0)
        );
        float fragmentation = smoothstep(0.255, 0.34, ageSeconds);
        float coreMask = hardMask(coreSdf)
          * mix(1.0, fragmentGate, fragmentation)
          * blastLife;
        float bladeMask = hardMask(bladeUnionSdf) * blastLife;
        float blastMask = max(coreMask, bladeMask);
        float shardMask = hardMask(shardSdf) * shardLife;
        float coreGlow = outerGlow(coreSdf, 0.05)
          * mix(1.0, fragmentGate, fragmentation)
          * blastLife;
        float bladeGlow = outerGlow(bladeUnionSdf, 0.025) * blastLife;
        float blastGlow = max(coreGlow, bladeGlow);
        float shardGlow = outerGlow(shardSdf, 0.05) * shardLife;
        float silhouette = max(collapseMask, max(blastMask, shardMask));
        float glow = max(collapseGlow, max(blastGlow, shardGlow));

        float collapseHot = 1.0 - smoothstep(-0.08, -0.022, collapseSdf);
        float coreHot = (1.0 - smoothstep(-0.075, -0.018, coreSdf)) * coreMask;
        float bladeHot = (1.0 - smoothstep(-0.065, -0.016, bladeUnionSdf)) * bladeMask;
        float hotWeight = clamp(
          max(collapseHot * collapseMask, max(max(coreHot, bladeHot), shardMask * 0.5)),
          0.0,
          1.0
        );
        vec3 color = mix(uColor, uHotColor, hotWeight);
        float alpha = max(silhouette, glow * 0.22);

        if (alpha < 0.001) {
          discard;
        }
        gl_FragColor = vec4(color * uIntensity, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}
