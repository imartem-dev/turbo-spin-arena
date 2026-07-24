import * as THREE from "three";

export const levelUpVfxDuration = 2.55;
const inwardDuration = 0.6;
const inwardParticleCount = 200;
const inwardSpawnRadius = 3.5;
const killRadiusSquared = 0.3 * 0.3;
const flashStartTime = 0.6;
const starburstDuration = 0.2;
const starburstGrowDuration = 0.05;
const ambientGlowDuration = 0.35;
const ambientGlowExpandDuration = 0.1;
const afterglowStartTime = flashStartTime + ambientGlowDuration;
const afterglowParticleCount = 48;
const sparkCount = 30;
const sparkLifetime = 0.9;
const sparkDamping = 7;
const reducedDuration = flashStartTime + ambientGlowDuration;
const starburstTextureUrl = `${import.meta.env.BASE_URL}assets/vfx/level-up/T_VFX_Flare_666.webp`;

const effectCenter = new THREE.Vector3(0, 1, 0);
const localUp = new THREE.Vector3(0, 1, 0);
const localForward = new THREE.Vector3(0, 0, 1);
const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
const black = new THREE.Color(0, 0, 0);
const afterglowGold = new THREE.Color("#ffb43b");
const afterglowWhite = new THREE.Color("#fff4bd");

type GlowUniform = { value: number };

type GlowShell = {
  mesh: THREE.Mesh;
  parent: THREE.Object3D;
};

type InwardParticleState = {
  active: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
};

type SparkState = {
  active: boolean;
  age: number;
  size: number;
  rotation: number;
  spin: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
};

type AfterglowParticleState = {
  active: boolean;
  age: number;
  lifetime: number;
  size: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
};

type FlashLayer = {
  mesh: THREE.Mesh;
  geometry: THREE.PlaneGeometry;
  material: THREE.ShaderMaterial;
  ownedTexture?: THREE.Texture;
};

export class LevelUpVfx {
  readonly group = new THREE.Group();

  private readonly inwardGeometry: THREE.PlaneGeometry;
  private readonly inwardMaterial: THREE.ShaderMaterial;
  private readonly inwardMesh: THREE.InstancedMesh;
  private readonly inwardParticles: InwardParticleState[];
  private readonly sparkGeometry: THREE.PlaneGeometry;
  private readonly sparkMaterial: THREE.ShaderMaterial;
  private readonly sparkMesh: THREE.InstancedMesh;
  private readonly sparks: SparkState[];
  private readonly shellMaterial: THREE.ShaderMaterial;
  private readonly afterglowGeometry: THREE.PlaneGeometry;
  private readonly afterglowMaterial: THREE.ShaderMaterial;
  private readonly afterglowMesh: THREE.InstancedMesh;
  private readonly afterglowParticles: AfterglowParticleState[];
  private readonly starburstTexture: THREE.Texture;
  private readonly glowShells: GlowShell[] = [];
  private readonly glowIntensity: GlowUniform = { value: 0 };
  private readonly worldPosition = new THREE.Vector3();
  private readonly direction = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();
  private readonly matrix = new THREE.Matrix4();
  private readonly quaternion = new THREE.Quaternion();
  private readonly rollQuaternion = new THREE.Quaternion();
  private readonly color = new THREE.Color();
  private target: THREE.Object3D | null = null;
  private age = 0;
  private spawnedInwardCount = 0;
  private burstTriggered = false;
  private flashTriggered = false;
  private afterglowTriggered = false;
  private starburstLayer: FlashLayer | null = null;
  private ambientGlowLayer: FlashLayer | null = null;
  private reducedMotion = false;
  private active = false;
  private disposed = false;

  constructor() {
    this.group.name = "Level Up VFX";
    this.group.visible = false;

    this.inwardGeometry = new THREE.PlaneGeometry(0.045, 0.16);
    this.inwardMaterial = createInwardMaterial();
    this.inwardMesh = new THREE.InstancedMesh(
      this.inwardGeometry,
      this.inwardMaterial,
      inwardParticleCount,
    );
    this.inwardMesh.name = "Level Up Inward Particles";
    this.inwardMesh.frustumCulled = false;
    this.inwardMesh.renderOrder = 5;
    this.inwardMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.inwardParticles = Array.from({ length: inwardParticleCount }, () => ({
      active: false,
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
    }));

    this.sparkGeometry = new THREE.PlaneGeometry(1, 1);
    this.sparkMaterial = createSparkMaterial();
    this.sparkMesh = new THREE.InstancedMesh(this.sparkGeometry, this.sparkMaterial, sparkCount);
    this.sparkMesh.name = "Level Up Outward Sparks";
    this.sparkMesh.frustumCulled = false;
    this.sparkMesh.renderOrder = 6;
    this.sparkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.sparks = Array.from({ length: sparkCount }, () => ({
      active: false,
      age: sparkLifetime,
      size: 0,
      rotation: 0,
      spin: 0,
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
    }));

    this.shellMaterial = createShellGlowMaterial(this.glowIntensity);

    this.afterglowGeometry = new THREE.PlaneGeometry(1, 1);
    this.afterglowMaterial = createAfterglowMaterial();
    this.afterglowMesh = new THREE.InstancedMesh(
      this.afterglowGeometry,
      this.afterglowMaterial,
      afterglowParticleCount,
    );
    this.afterglowMesh.name = "Level Up Rising Afterglow";
    this.afterglowMesh.frustumCulled = false;
    this.afterglowMesh.renderOrder = 6;
    this.afterglowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.afterglowParticles = Array.from({ length: afterglowParticleCount }, (_, index) => {
      this.afterglowMesh.setColorAt(index, black);
      return {
        active: false,
        age: 0,
        lifetime: 1,
        size: 0,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        color: new THREE.Color(),
      };
    });
    this.afterglowMesh.instanceColor?.setUsage(THREE.DynamicDrawUsage);

    this.starburstTexture = new THREE.TextureLoader().load(starburstTextureUrl);
    this.starburstTexture.name = "Level Up Starburst Mask";
    this.starburstTexture.colorSpace = THREE.SRGBColorSpace;
    this.starburstTexture.minFilter = THREE.LinearFilter;
    this.starburstTexture.magFilter = THREE.LinearFilter;

    this.clearInstanceMeshes();
    this.group.add(this.inwardMesh, this.sparkMesh, this.afterglowMesh);
  }

  triggerPowerUp(spinnerMesh: THREE.Object3D, reducedMotion = false): void {
    if (this.disposed) {
      return;
    }

    this.finishPlayback();
    this.target = spinnerMesh;
    this.reducedMotion = reducedMotion;
    this.age = 0;
    this.spawnedInwardCount = reducedMotion ? inwardParticleCount : 0;
    this.burstTriggered = reducedMotion;
    this.flashTriggered = false;
    this.afterglowTriggered = reducedMotion;
    this.active = true;
    this.group.visible = true;
    this.updateGroupPosition();
    this.installGlowShells(spinnerMesh);
    this.setGlowIntensity(0);
  }

  update(deltaTime: number, camera: THREE.Camera): void {
    if (!this.active || this.disposed) {
      return;
    }

    const step = Math.max(0, deltaTime);
    this.age += step;
    this.updateGroupPosition();
    this.updateGlow();

    if (!this.flashTriggered && this.age >= flashStartTime) {
      this.flashTriggered = true;
      this.spawnFlashLayers();
    }

    if (!this.reducedMotion) {
      this.spawnInwardParticlesForCurrentAge();
      this.updateInwardParticles(step);
      if (!this.burstTriggered && this.age >= flashStartTime) {
        this.burstTriggered = true;
        this.spawnSparkBurst();
      }
      this.updateSparks(step, camera);
    }

    this.updateFlashLayers();
    if (!this.afterglowTriggered && this.age >= afterglowStartTime) {
      this.afterglowTriggered = true;
      this.spawnAfterglowParticles();
    }
    if (!this.reducedMotion) {
      this.updateAfterglowParticles(step, camera);
    }

    const duration = this.reducedMotion ? reducedDuration : levelUpVfxDuration;
    if (this.age >= duration) {
      this.finishPlayback();
    }
  }

  isActive(): boolean {
    return this.active;
  }

  reset(): void {
    this.finishPlayback();
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.finishPlayback();
    this.disposed = true;
    this.group.removeFromParent();
    this.group.clear();
    this.inwardGeometry.dispose();
    this.inwardMaterial.dispose();
    this.sparkGeometry.dispose();
    this.sparkMaterial.dispose();
    this.shellMaterial.dispose();
    this.afterglowGeometry.dispose();
    this.afterglowMaterial.dispose();
    this.starburstTexture.dispose();
  }

  private spawnInwardParticlesForCurrentAge(): void {
    if (this.age >= inwardDuration) {
      if (this.spawnedInwardCount < inwardParticleCount) {
        this.spawnedInwardCount = inwardParticleCount;
      }
      this.clearInwardParticles();
      return;
    }

    const targetCount = Math.min(
      inwardParticleCount,
      Math.floor((this.age / inwardDuration) * inwardParticleCount),
    );
    while (this.spawnedInwardCount < targetCount) {
      this.spawnInwardParticle(this.spawnedInwardCount);
      this.spawnedInwardCount += 1;
    }
  }

  private spawnInwardParticle(index: number): void {
    const particle = this.inwardParticles[index];
    randomUnitVector(this.direction);
    particle.position.copy(effectCenter).addScaledVector(this.direction, inwardSpawnRadius);
    particle.velocity.copy(this.direction).multiplyScalar(-THREE.MathUtils.lerp(10, 20, Math.random()));
    particle.active = true;
  }

  private updateInwardParticles(deltaTime: number): void {
    if (this.age >= inwardDuration) {
      return;
    }

    let changed = false;
    for (let index = 0; index < this.inwardParticles.length; index += 1) {
      const particle = this.inwardParticles[index];
      if (!particle.active) {
        continue;
      }

      particle.position.addScaledVector(particle.velocity, deltaTime);
      this.direction.subVectors(particle.position, effectCenter);
      const crossedCenter = this.direction.dot(particle.velocity) >= 0;
      if (this.direction.lengthSq() <= killRadiusSquared || crossedCenter) {
        particle.active = false;
        this.inwardMesh.setMatrixAt(index, zeroMatrix);
        changed = true;
        continue;
      }

      this.direction.copy(particle.velocity).normalize();
      this.quaternion.setFromUnitVectors(localUp, this.direction);
      this.scale.set(1, 4, 1);
      this.matrix.compose(particle.position, this.quaternion, this.scale);
      this.inwardMesh.setMatrixAt(index, this.matrix);
      changed = true;
    }

    if (changed) {
      this.inwardMesh.instanceMatrix.needsUpdate = true;
    }
  }

  private spawnSparkBurst(): void {
    for (const spark of this.sparks) {
      randomUnitVector(this.direction);
      this.direction.y = Math.abs(this.direction.y) * 2;
      spark.active = true;
      spark.age = 0;
      spark.size = THREE.MathUtils.lerp(0.01, 0.1, Math.random());
      spark.rotation = Math.random() * Math.PI * 2;
      spark.spin = THREE.MathUtils.lerp(-8, 8, Math.random());
      spark.position.copy(effectCenter);
      spark.velocity.copy(this.direction).multiplyScalar(THREE.MathUtils.lerp(6, 10, Math.random()));
    }
  }

  private updateSparks(deltaTime: number, camera: THREE.Camera): void {
    let changed = false;
    const damping = Math.exp(-sparkDamping * deltaTime);

    for (let index = 0; index < this.sparks.length; index += 1) {
      const spark = this.sparks[index];
      if (!spark.active) {
        continue;
      }

      spark.age += deltaTime;
      if (spark.age >= sparkLifetime) {
        spark.active = false;
        this.sparkMesh.setMatrixAt(index, zeroMatrix);
        changed = true;
        continue;
      }

      spark.position.addScaledVector(spark.velocity, deltaTime);
      spark.velocity.multiplyScalar(damping);
      const life = 1 - spark.age / sparkLifetime;
      const size = spark.size * life;
      this.quaternion.copy(camera.quaternion);
      this.rollQuaternion.setFromAxisAngle(localForward, spark.rotation + spark.spin * spark.age);
      this.quaternion.multiply(this.rollQuaternion);
      this.scale.setScalar(size);
      this.matrix.compose(spark.position, this.quaternion, this.scale);
      this.sparkMesh.setMatrixAt(index, this.matrix);
      changed = true;
    }

    if (changed) {
      this.sparkMesh.instanceMatrix.needsUpdate = true;
    }
  }

  private spawnAfterglowParticles(): void {
    for (const particle of this.afterglowParticles) {
      const angle = Math.random() * Math.PI * 2;
      const radius = THREE.MathUtils.lerp(0.15, 0.85, Math.sqrt(Math.random()));
      const isLarge = Math.random() < 0.18;
      particle.active = true;
      particle.age = 0;
      particle.lifetime = THREE.MathUtils.lerp(1.15, 1.6, Math.random());
      particle.size = isLarge
        ? THREE.MathUtils.lerp(0.07, 0.13, Math.random())
        : THREE.MathUtils.lerp(0.018, 0.055, Math.random());
      particle.position.set(
        Math.cos(angle) * radius,
        THREE.MathUtils.lerp(0.65, 1.5, Math.random()),
        Math.sin(angle) * radius,
      );
      particle.velocity.set(
        THREE.MathUtils.lerp(-0.18, 0.18, Math.random()),
        THREE.MathUtils.lerp(0.35, 0.9, Math.random()),
        THREE.MathUtils.lerp(-0.18, 0.18, Math.random()),
      );
      particle.color
        .copy(afterglowGold)
        .lerp(afterglowWhite, THREE.MathUtils.lerp(isLarge ? 0.55 : 0.18, 0.9, Math.random()));
    }
  }

  private updateAfterglowParticles(deltaTime: number, camera: THREE.Camera): void {
    let changed = false;
    const horizontalDamping = Math.exp(-1.5 * deltaTime);
    const verticalDamping = Math.exp(-0.12 * deltaTime);

    for (let index = 0; index < this.afterglowParticles.length; index += 1) {
      const particle = this.afterglowParticles[index];
      if (!particle.active) {
        continue;
      }

      particle.age += deltaTime;
      if (particle.age >= particle.lifetime) {
        particle.active = false;
        this.afterglowMesh.setMatrixAt(index, zeroMatrix);
        this.afterglowMesh.setColorAt(index, black);
        changed = true;
        continue;
      }

      particle.position.addScaledVector(particle.velocity, deltaTime);
      particle.velocity.x *= horizontalDamping;
      particle.velocity.y *= verticalDamping;
      particle.velocity.z *= horizontalDamping;

      const normalizedAge = particle.age / particle.lifetime;
      const fade = 1 - smoothStep01((normalizedAge - 0.15) / 0.85);
      const size = particle.size * (0.72 + fade * 0.28);
      this.quaternion.copy(camera.quaternion);
      this.scale.setScalar(size);
      this.matrix.compose(particle.position, this.quaternion, this.scale);
      this.afterglowMesh.setMatrixAt(index, this.matrix);
      this.color.copy(particle.color).multiplyScalar(fade);
      this.afterglowMesh.setColorAt(index, this.color);
      changed = true;
    }

    if (changed) {
      this.afterglowMesh.instanceMatrix.needsUpdate = true;
      if (this.afterglowMesh.instanceColor) {
        this.afterglowMesh.instanceColor.needsUpdate = true;
      }
    }
  }

  private spawnFlashLayers(): void {
    this.starburstLayer = createStarburstLayer(this.starburstTexture);
    this.ambientGlowLayer = createAmbientGlowLayer();
    this.group.add(this.ambientGlowLayer.mesh, this.starburstLayer.mesh);
  }

  private updateFlashLayers(): void {
    const flashAge = this.age - flashStartTime;

    if (this.starburstLayer) {
      if (flashAge >= starburstDuration) {
        this.starburstLayer = this.disposeFlashLayer(this.starburstLayer);
      } else if (flashAge >= 0) {
        const normalizedAge = flashAge / starburstDuration;
        const grow = easeOutCubic(flashAge / starburstGrowDuration);
        const fadeAge = Math.max(0, flashAge - starburstGrowDuration);
        const fadeDuration = starburstDuration - starburstGrowDuration;
        const collapse = smoothStep01(fadeAge / fadeDuration);
        const opacity = fadeAge === 0 ? 1 : (1 - fadeAge / fadeDuration) ** 2;
        this.starburstLayer.material.uniforms.uScale.value =
          flashAge <= starburstGrowDuration ? grow * 1.2 : (1 - collapse) * 1.2;
        this.starburstLayer.material.uniforms.uRotation.value =
          THREE.MathUtils.degToRad(22.5) * smoothStep01(normalizedAge);
        this.starburstLayer.material.uniforms.uOpacity.value = opacity;
      }
    }

    if (this.ambientGlowLayer) {
      if (flashAge >= ambientGlowDuration) {
        this.ambientGlowLayer = this.disposeFlashLayer(this.ambientGlowLayer);
      } else if (flashAge >= 0) {
        if (flashAge <= ambientGlowExpandDuration) {
          const normalizedExpansion = flashAge / ambientGlowExpandDuration;
          const expansion =
            (1 - Math.exp(-6 * normalizedExpansion)) / (1 - Math.exp(-6));
          this.ambientGlowLayer.material.uniforms.uScale.value =
            THREE.MathUtils.lerp(0.2, 2.75, expansion);
          this.ambientGlowLayer.material.uniforms.uOpacity.value =
            THREE.MathUtils.lerp(0.6, 0.42, smoothStep01(normalizedExpansion));
        } else {
          const collapseAge = flashAge - ambientGlowExpandDuration;
          const collapseDuration = ambientGlowDuration - ambientGlowExpandDuration;
          const remaining = 1 - smoothStep01(collapseAge / collapseDuration);
          this.ambientGlowLayer.material.uniforms.uScale.value = 2.75 * remaining;
          this.ambientGlowLayer.material.uniforms.uOpacity.value = 0.42 * remaining;
        }
      }
    }
  }

  private updateGlow(): void {
    if (this.reducedMotion) {
      const rise = smoothStep01(this.age / flashStartTime);
      const fade = 1 - smoothStep01(
        (this.age - flashStartTime) / (reducedDuration - flashStartTime),
      );
      this.setGlowIntensity(this.age <= flashStartTime ? rise : fade);
      return;
    }

    if (this.age <= inwardDuration) {
      this.setGlowIntensity(smoothStep01(this.age / inwardDuration));
    } else if (this.age <= afterglowStartTime) {
      this.setGlowIntensity(1);
    } else {
      this.setGlowIntensity(
        1 - smoothStep01((this.age - afterglowStartTime) / (levelUpVfxDuration - afterglowStartTime)),
      );
    }
  }

  private installGlowShells(target: THREE.Object3D): void {
    target.traverse((child) => {
      if (!(child instanceof THREE.Mesh) || child.userData.levelUpGlowShell === true) {
        return;
      }
      if (child.userData.spinnerOutline === true) {
        return;
      }

      const shell = new THREE.Mesh(child.geometry, this.shellMaterial);
      shell.name = `${child.name || "Spinner"} Level Up Glow Shell`;
      shell.userData.levelUpGlowShell = true;
      shell.frustumCulled = false;
      shell.renderOrder = 4;
      shell.scale.setScalar(1.045);
      child.add(shell);
      this.glowShells.push({ mesh: shell, parent: child });
    });
  }

  private setGlowIntensity(value: number): void {
    this.glowIntensity.value = value;
  }

  private removeGlowShells(): void {
    for (const shell of this.glowShells) {
      shell.parent.remove(shell.mesh);
    }
    this.glowShells.length = 0;
    this.setGlowIntensity(0);
  }

  private updateGroupPosition(): void {
    if (!this.target) {
      return;
    }

    this.target.updateWorldMatrix(true, false);
    this.target.getWorldPosition(this.worldPosition);
    if (this.group.parent) {
      this.group.parent.updateWorldMatrix(true, false);
      this.group.parent.worldToLocal(this.worldPosition);
    }
    this.group.position.copy(this.worldPosition);
  }

  private finishPlayback(): void {
    this.active = false;
    this.target = null;
    this.group.visible = false;
    this.starburstLayer = this.disposeFlashLayer(this.starburstLayer);
    this.ambientGlowLayer = this.disposeFlashLayer(this.ambientGlowLayer);
    this.removeGlowShells();
    this.clearInstanceMeshes();
  }

  private disposeFlashLayer(layer: FlashLayer | null): null {
    if (!layer) {
      return null;
    }

    layer.mesh.removeFromParent();
    layer.geometry.dispose();
    layer.material.dispose();
    layer.ownedTexture?.dispose();
    return null;
  }

  private clearInstanceMeshes(): void {
    this.clearInwardParticles();
    for (let index = 0; index < this.sparks.length; index += 1) {
      this.sparks[index].active = false;
      this.sparkMesh.setMatrixAt(index, zeroMatrix);
    }
    this.sparkMesh.instanceMatrix.needsUpdate = true;
    this.clearAfterglowParticles();
  }

  private clearAfterglowParticles(): void {
    for (let index = 0; index < this.afterglowParticles.length; index += 1) {
      this.afterglowParticles[index].active = false;
      this.afterglowMesh.setMatrixAt(index, zeroMatrix);
      this.afterglowMesh.setColorAt(index, black);
    }
    this.afterglowMesh.instanceMatrix.needsUpdate = true;
    if (this.afterglowMesh.instanceColor) {
      this.afterglowMesh.instanceColor.needsUpdate = true;
    }
  }

  private clearInwardParticles(): void {
    for (let index = 0; index < this.inwardParticles.length; index += 1) {
      this.inwardParticles[index].active = false;
      this.inwardMesh.setMatrixAt(index, zeroMatrix);
    }
    this.inwardMesh.instanceMatrix.needsUpdate = true;
  }
}

function randomUnitVector(target: THREE.Vector3): THREE.Vector3 {
  const y = Math.random() * 2 - 1;
  const radial = Math.sqrt(Math.max(0, 1 - y * y));
  const angle = Math.random() * Math.PI * 2;
  return target.set(Math.cos(angle) * radial, y, Math.sin(angle) * radial);
}

function smoothStep01(value: number): number {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}

function easeOutCubic(value: number): number {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return 1 - (1 - clamped) ** 3;
}

function createAmbientGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to create the Level Up ambient glow texture");
  }

  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255, 248, 214, 1)");
  gradient.addColorStop(0.2, "rgba(255, 180, 72, 0.72)");
  gradient.addColorStop(0.5, "rgba(255, 103, 16, 0.24)");
  gradient.addColorStop(0.76, "rgba(255, 83, 0, 0)");
  gradient.addColorStop(1, "rgba(255, 83, 0, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function createInwardMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      void main() {
        float sideFade = smoothstep(0.0, 0.35, vUv.x) * smoothstep(0.0, 0.35, 1.0 - vUv.x);
        float lengthFade = smoothstep(0.0, 0.16, vUv.y) * (1.0 - smoothstep(0.58, 1.0, vUv.y));
        float alpha = sideFade * lengthFade;
        vec3 color = mix(vec3(1.8, 0.22, 0.015), vec3(4.0, 2.1, 0.45), vUv.y);
        gl_FragColor = vec4(color, alpha);
      }
    `,
  });
}

function createSparkMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      void main() {
        vec2 centeredUv = vUv - 0.5;
        float alpha = 1.0 - smoothstep(0.06, 0.5, length(centeredUv));
        gl_FragColor = vec4(vec3(4.0, 0.75, 0.08), alpha);
      }
    `,
  });
}

function createAfterglowMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vParticleColor;
      void main() {
        vUv = uv;
        #ifdef USE_INSTANCING_COLOR
          vParticleColor = instanceColor;
        #else
          vParticleColor = vec3(1.0);
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vParticleColor;
      void main() {
        float distanceToCenter = length(vUv - 0.5);
        float alpha = 1.0 - smoothstep(0.16, 0.5, distanceToCenter);
        float hotCore = 1.0 - smoothstep(0.0, 0.22, distanceToCenter);
        vec3 color = vParticleColor * (2.5 + hotCore * 1.5);
        gl_FragColor = vec4(color, alpha);
      }
    `,
  });
}

function createShellGlowMaterial(intensity: GlowUniform): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uIntensity: intensity,
      uGlowColor: { value: new THREE.Color("#ff8a1f").multiplyScalar(3.2) },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    vertexShader: `
      varying vec3 vViewNormal;
      varying vec3 vViewPosition;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -viewPosition.xyz;
        vViewNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uIntensity;
      uniform vec3 uGlowColor;
      varying vec3 vViewNormal;
      varying vec3 vViewPosition;
      void main() {
        vec3 viewDirection = normalize(vViewPosition);
        float fresnel = pow(1.0 - abs(dot(normalize(vViewNormal), viewDirection)), 1.7);
        float alpha = smoothstep(0.08, 0.9, fresnel) * uIntensity * 0.52;
        gl_FragColor = vec4(uGlowColor * (0.35 + fresnel), alpha);
      }
    `,
  });
}

function createStarburstLayer(texture: THREE.Texture): FlashLayer {
  const geometry = new THREE.PlaneGeometry(5, 5);
  const material = createStarburstMaterial(texture);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "Level Up Sharp Core Starburst";
  mesh.position.copy(effectCenter);
  mesh.frustumCulled = false;
  mesh.renderOrder = 8;
  return { mesh, geometry, material };
}

function createAmbientGlowLayer(): FlashLayer {
  const texture = createAmbientGlowTexture();
  const geometry = new THREE.PlaneGeometry(6, 6);
  const material = createAmbientGlowMaterial(texture);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "Level Up Expanding Ambient Glow";
  mesh.position.copy(effectCenter);
  mesh.frustumCulled = false;
  mesh.renderOrder = 7;
  return { mesh, geometry, material, ownedTexture: texture };
}

const billboardVertexShader = `
  uniform float uScale;
  uniform float uRotation;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    float cosine = cos(uRotation);
    float sine = sin(uRotation);
    mat2 rotation = mat2(cosine, sine, -sine, cosine);
    vec2 offset = rotation * position.xy * uScale;
    vec4 center = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    center.xy += offset;
    gl_Position = projectionMatrix * center;
  }
`;

function createStarburstMaterial(texture: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: texture },
      uOpacity: { value: 0 },
      uScale: { value: 0 },
      uRotation: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    vertexShader: billboardVertexShader,
    fragmentShader: `
      uniform sampler2D uTexture;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        vec4 texel = texture2D(uTexture, vUv);
        float brightness = max(max(texel.r, texel.g), texel.b);
        float mask = smoothstep(0.015, 0.22, brightness);
        float hotCore = smoothstep(0.55, 1.0, brightness);
        vec3 rayColor = vec3(3.8, 0.62, 0.045);
        vec3 coreColor = vec3(5.0, 4.1, 2.3);
        gl_FragColor = vec4(mix(rayColor, coreColor, hotCore), mask * uOpacity);
      }
    `,
  });
}

function createAmbientGlowMaterial(texture: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: texture },
      uOpacity: { value: 0.6 },
      uScale: { value: 0.2 },
      uRotation: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    vertexShader: billboardVertexShader,
    fragmentShader: `
      uniform sampler2D uTexture;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        vec4 texel = texture2D(uTexture, vUv);
        gl_FragColor = vec4(texel.rgb * 2.2, texel.a * uOpacity);
      }
    `,
  });
}
