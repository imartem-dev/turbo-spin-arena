import * as THREE from "three";
import type { ArenaBonus, ArenaBonusType } from "../simulation/arenaBonuses";
import { StylizedOrbVfxPool, type StylizedOrbVfx } from "./stylizedOrbVfx";

export type ArenaBonusVfxType = ArenaBonusType | "heal";

type BonusPalette = Record<ArenaBonusVfxType, string>;

type BonusPickupVisual = {
  id: number;
  type: ArenaBonusVfxType;
  orb: StylizedOrbVfx;
};

type BonusParticleKind = "radial" | "stream" | "shard";

type BonusParticle = {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  material: THREE.MeshBasicMaterial;
  kind: BonusParticleKind;
  velocity: THREE.Vector3;
  origin: THREE.Vector3;
  age: number;
  life: number;
  spin: number;
  swirl: number;
  baseScale: number;
};

type BonusPulse = {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  material: THREE.MeshBasicMaterial;
  kind: "flash" | "ring";
  age: number;
  life: number;
  maxScale: number;
  baseOpacity: number;
};

const hiddenPosition = new THREE.Vector3(0, -40, 0);
const maxBonusParticles = 160;
const maxBonusPulses = 36;

export class BonusVfxPool {
  private readonly activePickups = new Map<number, BonusPickupVisual>();
  private readonly orbPool = new StylizedOrbVfxPool({ size: 5 });
  private readonly activeParticles: BonusParticle[] = [];
  private readonly idleParticles: BonusParticle[] = [];
  private readonly activePulses: BonusPulse[] = [];
  private readonly idlePulses: BonusPulse[] = [];
  private readonly flashGeometry = new THREE.SphereGeometry(1, 18, 10);
  private readonly ringGeometries = createIrregularRingGeometries();
  private readonly radialParticleGeometry = new THREE.SphereGeometry(0.045, 8, 6);
  private readonly streamParticleGeometry = new THREE.SphereGeometry(0.038, 8, 6);
  private readonly shardGeometry = new THREE.BoxGeometry(0.09, 0.026, 0.09);
  private readonly pickupPosition = new THREE.Vector3();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly palette: BonusPalette,
    private readonly reducedMotionQuery: MediaQueryList,
  ) {
    scene.add(this.orbPool.group);
  }

  prewarm(options: { particles: number; pulses: number }): void {
    for (let i = this.idleParticles.length; i < options.particles; i += 1) {
      this.idleParticles.push(this.createParticle("radial"));
    }
    for (let i = this.idlePulses.length; i < options.pulses; i += 1) {
      this.idlePulses.push(this.createPulse("ring"));
    }
  }

  syncActivePickups(activeBonuses: ArenaBonus[], _deltaTime: number, _elapsedTime: number): void {
    const activeIds = new Set(activeBonuses.map((bonus) => bonus.id));
    for (const bonus of activeBonuses) {
      const visual = this.acquirePickup(bonus);
      if (visual) {
        this.updateActivePickup(visual, bonus);
      }
    }

    for (const [id, visual] of this.activePickups) {
      if (activeIds.has(id)) {
        continue;
      }
      this.releasePickup(visual);
      this.activePickups.delete(id);
    }
  }

  startCollectEffect(bonus: ArenaBonus): void {
    const visual = this.activePickups.get(bonus.id);
    if (visual) {
      this.releasePickup(visual);
      this.activePickups.delete(bonus.id);
    }
    this.spawnCollectBurst(bonus.position, bonus.type);
  }

  startHealZonePulse(position: THREE.Vector3): void {
    this.spawnPulse(position, "ring", "heal", 0.75, 2.6);
    this.spawnStreamParticles(position, "heal", this.reducedMotionQuery.matches ? 8 : 18);
  }

  update(deltaTime: number, elapsedTime: number): void {
    this.orbPool.update(deltaTime, elapsedTime);
    this.updateParticles(deltaTime, elapsedTime);
    this.updatePulses(deltaTime);
  }

  reset(): void {
    for (const visual of this.activePickups.values()) {
      this.releasePickup(visual);
    }
    this.activePickups.clear();
    while (this.activeParticles.length > 0) {
      const particle = this.activeParticles.pop()!;
      particle.mesh.visible = false;
      particle.mesh.position.copy(hiddenPosition);
      particle.material.opacity = 0;
      this.idleParticles.push(particle);
    }
    while (this.activePulses.length > 0) {
      const pulse = this.activePulses.pop()!;
      pulse.mesh.visible = false;
      pulse.mesh.position.copy(hiddenPosition);
      pulse.material.opacity = 0;
      this.idlePulses.push(pulse);
    }
  }

  dispose(): void {
    this.activePickups.clear();
    this.scene.remove(this.orbPool.group);
    this.orbPool.dispose();
    for (const particle of [...this.activeParticles, ...this.idleParticles]) {
      this.scene.remove(particle.mesh);
      particle.material.dispose();
    }
    for (const pulse of [...this.activePulses, ...this.idlePulses]) {
      this.scene.remove(pulse.mesh);
      pulse.material.dispose();
    }
    this.flashGeometry.dispose();
    for (const geometry of this.ringGeometries) {
      geometry.dispose();
    }
    this.radialParticleGeometry.dispose();
    this.streamParticleGeometry.dispose();
    this.shardGeometry.dispose();
  }

  private acquirePickup(bonus: ArenaBonus): BonusPickupVisual | null {
    const existing = this.activePickups.get(bonus.id);
    if (existing) {
      return existing;
    }

    this.pickupPosition.copy(bonus.position);
    this.pickupPosition.y += 0.72;
    const orb = this.orbPool.acquire(this.pickupPosition, this.palette[bonus.type]);
    if (!orb) {
      return null;
    }
    const visual: BonusPickupVisual = { id: bonus.id, type: bonus.type, orb };
    this.activePickups.set(bonus.id, visual);
    return visual;
  }

  private updateActivePickup(visual: BonusPickupVisual, bonus: ArenaBonus): void {
    this.pickupPosition.copy(bonus.position);
    this.pickupPosition.y += 0.72;
    visual.orb.setPosition(this.pickupPosition);
    if (visual.type !== bonus.type) {
      visual.type = bonus.type;
      visual.orb.setColor(this.palette[bonus.type]);
    }
  }

  private releasePickup(visual: BonusPickupVisual): void {
    this.orbPool.release(visual.orb);
  }

  private spawnCollectBurst(position: THREE.Vector3, type: ArenaBonusVfxType): void {
    this.spawnPulse(position, "flash", type, 0.16, type === "heal" ? 1.3 : 1.1);
    this.spawnPulse(position, "ring", type, 0.68, THREE.MathUtils.randFloat(1.6, 2.1));
    this.spawnRadialParticles(position, type, this.reducedMotionQuery.matches ? 10 : THREE.MathUtils.randInt(18, 26));
    if (!this.reducedMotionQuery.matches) {
      this.spawnStreamParticles(position, type, THREE.MathUtils.randInt(10, 14));
    }
  }

  private spawnPulse(position: THREE.Vector3, kind: BonusPulse["kind"], type: ArenaBonusVfxType, life: number, maxScale: number): void {
    if (this.activePulses.length >= maxBonusPulses) {
      return;
    }

    const pulse = this.idlePulses.pop() ?? this.createPulse(kind);
    pulse.kind = kind;
    pulse.age = 0;
    pulse.life = life;
    pulse.maxScale = maxScale;
    pulse.baseOpacity = kind === "flash" ? 0.85 : THREE.MathUtils.randFloat(0.24, 0.34);
    pulse.mesh.geometry = kind === "flash" ? this.flashGeometry : this.getRandomRingGeometry();
    pulse.material.color.set(kind === "flash" ? "#ffffff" : this.palette[type]);
    pulse.material.opacity = pulse.baseOpacity;
    pulse.mesh.position.copy(position).add(new THREE.Vector3(0, kind === "flash" ? 0.48 : 0.07, 0));
    pulse.mesh.rotation.set(kind === "flash" ? 0 : Math.PI / 2, 0, 0);
    pulse.mesh.scale.setScalar(0.18);
    pulse.mesh.visible = true;
    this.activePulses.push(pulse);
  }

  private createPulse(kind: BonusPulse["kind"]): BonusPulse {
    const material = this.createAdditiveMaterial("#ffffff", 0);
    const mesh = new THREE.Mesh(kind === "flash" ? this.flashGeometry : this.getRandomRingGeometry(), material);
    mesh.visible = false;
    mesh.position.copy(hiddenPosition);
    this.scene.add(mesh);
    return { mesh, material, kind, age: 0, life: 1, maxScale: 1, baseOpacity: 0 };
  }

  private spawnRadialParticles(position: THREE.Vector3, type: ArenaBonusVfxType, count: number): void {
    for (let i = 0; i < count; i += 1) {
      const kind: BonusParticleKind = i % 5 === 0 ? "shard" : "radial";
      const particle = this.acquireParticle(kind);
      if (!particle) {
        return;
      }

      const angle = (i / count) * Math.PI * 2 + THREE.MathUtils.randFloatSpread(0.35);
      const speed = THREE.MathUtils.randFloat(1.9, 4.4);
      particle.velocity.set(Math.cos(angle) * speed, THREE.MathUtils.randFloat(0.65, 1.7), Math.sin(angle) * speed);
      particle.origin.copy(position);
      particle.mesh.position.copy(position).add(new THREE.Vector3(0, 0.46 + Math.random() * 0.18, 0));
      particle.mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      particle.baseScale = kind === "shard" ? THREE.MathUtils.randFloat(0.85, 1.35) : THREE.MathUtils.randFloat(0.7, 1.15);
      particle.life = THREE.MathUtils.randFloat(0.42, 0.68);
      particle.age = 0;
      particle.spin = THREE.MathUtils.randFloatSpread(12);
      particle.swirl = THREE.MathUtils.randFloatSpread(1.8);
      particle.material.color.set(this.palette[type]);
      particle.material.opacity = 0.92;
    }
  }

  private spawnStreamParticles(position: THREE.Vector3, type: ArenaBonusVfxType, count: number): void {
    for (let i = 0; i < count; i += 1) {
      const particle = this.acquireParticle("stream");
      if (!particle) {
        return;
      }

      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.35;
      const radius = THREE.MathUtils.randFloat(0.12, 0.38);
      particle.origin.copy(position);
      particle.mesh.position.copy(position).add(new THREE.Vector3(Math.cos(angle) * radius, 0.42, Math.sin(angle) * radius));
      particle.velocity.set(Math.cos(angle) * 0.28, THREE.MathUtils.randFloat(2.0, 3.5), Math.sin(angle) * 0.28);
      particle.baseScale = THREE.MathUtils.randFloat(0.65, 1.05);
      particle.life = THREE.MathUtils.randFloat(0.55, 0.8);
      particle.age = 0;
      particle.spin = THREE.MathUtils.randFloatSpread(7);
      particle.swirl = THREE.MathUtils.randFloat(2.4, 4.8) * (i % 2 === 0 ? 1 : -1);
      particle.material.color.set(this.palette[type]);
      particle.material.opacity = type === "heal" ? 0.72 : 0.82;
    }
  }

  private acquireParticle(kind: BonusParticleKind): BonusParticle | null {
    if (this.activeParticles.length >= maxBonusParticles) {
      return null;
    }

    const particle = this.idleParticles.pop() ?? this.createParticle(kind);
    particle.kind = kind;
    particle.mesh.geometry = this.getParticleGeometry(kind);
    particle.mesh.visible = true;
    particle.mesh.scale.setScalar(1);
    this.activeParticles.push(particle);
    return particle;
  }

  private createParticle(kind: BonusParticleKind): BonusParticle {
    const material = this.createAdditiveMaterial("#ffffff", 0);
    const mesh = new THREE.Mesh(this.getParticleGeometry(kind), material);
    mesh.visible = false;
    mesh.position.copy(hiddenPosition);
    this.scene.add(mesh);
    return {
      mesh,
      material,
      kind,
      velocity: new THREE.Vector3(),
      origin: new THREE.Vector3(),
      age: 0,
      life: 1,
      spin: 0,
      swirl: 0,
      baseScale: 1,
    };
  }

  private updateParticles(deltaTime: number, elapsedTime: number): void {
    for (let i = this.activeParticles.length - 1; i >= 0; i -= 1) {
      const particle = this.activeParticles[i];
      particle.age += deltaTime;
      const t = THREE.MathUtils.clamp(particle.age / particle.life, 0, 1);

      if (particle.kind === "stream") {
        const swirlAngle = elapsedTime * particle.swirl + particle.age * 6;
        particle.mesh.position.x += Math.cos(swirlAngle) * 0.018;
        particle.mesh.position.z += Math.sin(swirlAngle) * 0.018;
        particle.velocity.y += 0.75 * deltaTime;
      } else {
        particle.velocity.y -= 3.4 * deltaTime;
      }

      particle.mesh.position.addScaledVector(particle.velocity, deltaTime);
      particle.mesh.rotation.x += particle.spin * deltaTime;
      particle.mesh.rotation.z -= particle.spin * 0.6 * deltaTime;
      particle.material.opacity = (1 - easeInCubic(t)) * (particle.kind === "stream" ? 0.76 : 0.95);
      particle.mesh.scale.setScalar(particle.baseScale * (1 - t * 0.72));

      if (t >= 1) {
        this.releaseParticle(i);
      }
    }
  }

  private updatePulses(deltaTime: number): void {
    for (let i = this.activePulses.length - 1; i >= 0; i -= 1) {
      const pulse = this.activePulses[i];
      pulse.age += deltaTime;
      const t = THREE.MathUtils.clamp(pulse.age / pulse.life, 0, 1);
      const grow = easeOutCubic(t);
      pulse.mesh.scale.setScalar(THREE.MathUtils.lerp(0.18, pulse.maxScale, grow));
      const distanceFade = pulse.kind === "ring" ? 1 - grow * 0.38 : 1;
      const timeFade = pulse.kind === "ring" ? (1 - t) ** 2.25 : 1 - easeInCubic(t);
      pulse.material.opacity = pulse.baseOpacity * distanceFade * timeFade;

      if (t >= 1) {
        this.releasePulse(i);
      }
    }
  }

  private releaseParticle(index: number): void {
    const [particle] = this.activeParticles.splice(index, 1);
    particle.mesh.visible = false;
    particle.mesh.position.copy(hiddenPosition);
    particle.material.opacity = 0;
    this.idleParticles.push(particle);
  }

  private releasePulse(index: number): void {
    const [pulse] = this.activePulses.splice(index, 1);
    pulse.mesh.visible = false;
    pulse.mesh.position.copy(hiddenPosition);
    pulse.material.opacity = 0;
    this.idlePulses.push(pulse);
  }

  private getParticleGeometry(kind: BonusParticleKind): THREE.BufferGeometry {
    if (kind === "shard") {
      return this.shardGeometry;
    }
    if (kind === "stream") {
      return this.streamParticleGeometry;
    }
    return this.radialParticleGeometry;
  }

  private getRandomRingGeometry(): THREE.BufferGeometry {
    return this.ringGeometries[Math.floor(Math.random() * this.ringGeometries.length)];
  }

  private createAdditiveMaterial(color: string, opacity: number): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
  }
}

function easeOutCubic(value: number): number {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return 1 - (1 - t) ** 3;
}

function easeInCubic(value: number): number {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t ** 3;
}

function createIrregularRingGeometries(): THREE.BufferGeometry[] {
  const geometries: THREE.BufferGeometry[] = [];
  for (let variant = 0; variant < 8; variant += 1) {
    geometries.push(createIrregularRingGeometry(variant));
  }
  return geometries;
}

function createIrregularRingGeometry(seed: number, baseRadius = 1, baseWidth = 0.052, jaggedScale = 1): THREE.BufferGeometry {
  const segmentCount = 96;
  const positions: number[] = [];
  const indices: number[] = [];
  const radiusOffsets: number[] = [];
  const widthOffsets: number[] = [];

  for (let i = 0; i <= segmentCount; i += 1) {
    const wrappedIndex = i % segmentCount;
    const jagged = (seededSignedNoise(seed, wrappedIndex, 0) * 0.11
      + seededSignedNoise(seed, Math.floor(wrappedIndex / 3), 1) * 0.08
      + Math.sin((wrappedIndex / segmentCount) * Math.PI * 10 + seed * 1.7) * 0.035) * jaggedScale;
    const width = baseWidth
      + seededNoise(seed, wrappedIndex, 2) * baseWidth * 1.35
      + seededNoise(seed, Math.floor(wrappedIndex / 5), 3) * baseWidth * 0.86;
    radiusOffsets.push(jagged);
    widthOffsets.push(width);
  }

  for (let i = 0; i <= segmentCount; i += 1) {
    const angle = (i / segmentCount) * Math.PI * 2;
    const normalX = Math.cos(angle);
    const normalY = Math.sin(angle);
    const centerRadius = baseRadius + radiusOffsets[i];
    const halfWidth = widthOffsets[i] * 0.5;
    const outerRadius = centerRadius + halfWidth;
    const innerRadius = Math.max(0.12, centerRadius - halfWidth * (0.72 + seededNoise(seed, i, 4) * 0.7));

    positions.push(normalX * outerRadius, normalY * outerRadius, 0);
    positions.push(normalX * innerRadius, normalY * innerRadius, 0);
  }

  for (let i = 0; i < segmentCount; i += 1) {
    const currentOuter = i * 2;
    const currentInner = currentOuter + 1;
    const nextOuter = currentOuter + 2;
    const nextInner = currentOuter + 3;
    indices.push(currentOuter, nextOuter, currentInner);
    indices.push(nextOuter, nextInner, currentInner);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function seededNoise(seed: number, a: number, b: number): number {
  const value = Math.sin(seed * 91.7 + a * 127.1 + b * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function seededSignedNoise(seed: number, a: number, b: number): number {
  return seededNoise(seed, a, b) * 2 - 1;
}
