import * as THREE from "three";
import { createAnimeFillMaterial, prepareSpinnerModel } from "../rendering/animeSpinnerMaterial";

export const spinnerDeathVfxDuration = 1.8;
export const spinnerDeathFragmentNames = [
  "fragment_01",
  "fragment_02",
  "fragment_03",
  "fragment_04",
  "fragment_05",
  "fragment_06",
  "fragment_07",
] as const;

export type SpinnerDeathSnapshot = {
  matrixWorld: THREE.Matrix4;
  colors: readonly [string, string, string];
  inheritedVelocity: THREE.Vector3;
  impactDirection: THREE.Vector3;
  impactPosition: THREE.Vector3;
};

type FragmentFill = {
  mesh: THREE.InstancedMesh;
  colorSlot: 0 | 1 | 2;
};

type FragmentMotion = {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  quaternion: THREE.Quaternion;
  baseScale: THREE.Vector3;
  angularAxis: THREE.Vector3;
  angularSpeed: number;
  bounceCount: number;
  clearance: number;
};

type DebrisMotion = {
  archetype: 0 | 1;
  localIndex: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  quaternion: THREE.Quaternion;
  baseScale: THREE.Vector3;
  angularAxis: THREE.Vector3;
  angularSpeed: number;
  age: number;
  lifetime: number;
  bounced: boolean;
};

type EffectSlot = {
  active: boolean;
  age: number;
  fragments: FragmentMotion[];
  debris: DebrisMotion[];
};

const launchDelay = 0.035;
const shrinkStart = 1.45;
const shrinkEnd = 1.75;
const largeFragmentGravity = -22;
const debrisGravity = -26;
const largeAngularDamping = 2.8;
const inheritedVelocityFactor = 0.35;
const debrisPerArchetype = 14;
const debrisPerEffect = debrisPerArchetype * 2;
const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);

export class SpinnerDeathVfxPool {
  private readonly slots: EffectSlot[];
  private readonly restMatrices = spinnerDeathFragmentNames.map(() => new THREE.Matrix4());
  private readonly fragmentRadii = spinnerDeathFragmentNames.map(() => 0);
  private readonly fillsByFragment = spinnerDeathFragmentNames.map(() => [] as FragmentFill[]);
  private readonly allFills: FragmentFill[] = [];
  private readonly outlineTargets: THREE.Object3D[] = [];
  private readonly scratchMatrix = new THREE.Matrix4();
  private readonly scratchRelativeMatrix = new THREE.Matrix4();
  private readonly scratchQuaternion = new THREE.Quaternion();
  private readonly scratchScale = new THREE.Vector3();
  private readonly scratchOrigin = new THREE.Vector3();
  private readonly scratchDirection = new THREE.Vector3();
  private readonly scratchImpact = new THREE.Vector3();
  private readonly scratchImpactPosition = new THREE.Vector3();
  private readonly scratchColor = new THREE.Color();
  private readonly scratchBounds = new THREE.Box3();
  private readonly scratchSphere = new THREE.Sphere();
  private readonly debrisMeshes: [THREE.InstancedMesh, THREE.InstancedMesh];
  private playSerial = 0;
  private ready = false;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly getGroundHeight: (x: number, z: number) => number,
    private readonly capacity = 32,
  ) {
    this.slots = Array.from({ length: capacity }, () => ({
      active: false,
      age: 0,
      fragments: spinnerDeathFragmentNames.map(() => ({
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        quaternion: new THREE.Quaternion(),
        baseScale: new THREE.Vector3(1, 1, 1),
        angularAxis: new THREE.Vector3(0, 1, 0),
        angularSpeed: 0,
        bounceCount: 0,
        clearance: 0,
      })),
      debris: Array.from({ length: debrisPerEffect }, (_, index) => ({
        archetype: index < debrisPerArchetype ? 0 : 1,
        localIndex: index % debrisPerArchetype,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        quaternion: new THREE.Quaternion(),
        baseScale: new THREE.Vector3(1, 1, 1),
        angularAxis: new THREE.Vector3(0, 1, 0),
        angularSpeed: 0,
        age: 0,
        lifetime: 0,
        bounced: false,
      })),
    }));
    this.debrisMeshes = this.createDebrisMeshes();
  }

  setModelSource(source: THREE.Group, rotationX: number, targetDiameter: number): void {
    this.disposeFills();
    const prepared = prepareSpinnerModel(source, rotationX, targetDiameter);
    prepared.root.updateMatrixWorld(true);
    const fragments = validateSpinnerDeathFragments(prepared.root);

    for (let fragmentIndex = 0; fragmentIndex < fragments.length; fragmentIndex += 1) {
      const fragment = fragments[fragmentIndex];
      this.scratchBounds.makeEmpty();
      this.restMatrices[fragmentIndex].copy(fragment.matrixWorld);
      this.scratchRelativeMatrix.copy(fragment.matrixWorld).invert();

      fragment.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
        const sourceMaterial = sourceMaterials[0];
        const geometry = object.geometry.clone();
        geometry.applyMatrix4(this.scratchMatrix.multiplyMatrices(this.scratchRelativeMatrix, object.matrixWorld));
        if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
        geometry.computeBoundingBox();
        if (geometry.boundingBox) this.scratchBounds.union(geometry.boundingBox);
        const colorSlot = resolveColorSlot(sourceMaterial.name);
        const material = createAnimeFillMaterial(sourceMaterial, "#ffffff");
        const mesh = new THREE.InstancedMesh(geometry, material, this.capacity);
        mesh.name = `Spinner Death ${fragment.name} ${sourceMaterial.name || this.allFills.length + 1}`;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.frustumCulled = false;
        mesh.renderOrder = 1;
        mesh.count = 0;
        for (let slotIndex = 0; slotIndex < this.capacity; slotIndex += 1) {
          mesh.setMatrixAt(slotIndex, hiddenMatrix);
          mesh.setColorAt(slotIndex, this.scratchColor.set("#ffffff"));
        }
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        const fill = { mesh, colorSlot };
        this.fillsByFragment[fragmentIndex].push(fill);
        this.allFills.push(fill);
        this.outlineTargets.push(mesh);
        this.scene.add(mesh);
      });
      this.fragmentRadii[fragmentIndex] = this.scratchBounds.isEmpty()
        ? 0
        : this.scratchBounds.getBoundingSphere(this.scratchSphere).radius;
    }

    prepared.root.traverse((object) => {
      if (object instanceof THREE.Mesh) object.geometry.dispose();
    });
    this.ready = true;
  }

  play(snapshot: SpinnerDeathSnapshot, reducedMotion: boolean, startDelay = 0): boolean {
    if (!this.ready) return false;
    const slotIndex = this.slots.findIndex((slot) => !slot.active);
    if (slotIndex < 0) return false;

    const slot = this.slots[slotIndex];
    const motionScale = reducedMotion ? 0.65 : 1;
    const serial = this.playSerial++;
    slot.active = true;
    slot.age = -Math.max(0, startDelay);
    this.scratchOrigin.setFromMatrixPosition(snapshot.matrixWorld);
    this.scratchImpact.copy(snapshot.impactDirection).setY(0);
    if (this.scratchImpact.lengthSq() > 0.000001) this.scratchImpact.normalize();
    else this.scratchImpact.set(1, 0, 0);
    this.scratchImpactPosition.copy(snapshot.impactPosition);

    for (let fragmentIndex = 0; fragmentIndex < slot.fragments.length; fragmentIndex += 1) {
      const motion = slot.fragments[fragmentIndex];
      this.scratchMatrix.multiplyMatrices(snapshot.matrixWorld, this.restMatrices[fragmentIndex]);
      this.scratchMatrix.decompose(motion.position, motion.quaternion, motion.baseScale);
      this.scratchDirection.subVectors(motion.position, this.scratchImpactPosition).setY(0);
      if (this.scratchDirection.lengthSq() <= 0.000001) {
        const angle = seededRandom(serial, fragmentIndex, 0) * Math.PI * 2;
        this.scratchDirection.set(Math.cos(angle), 0, Math.sin(angle));
      } else {
        this.scratchDirection.normalize();
      }

      const outgoingBoost = this.scratchDirection.dot(this.scratchImpact) > 0.45 ? 1.25 : 1;
      const directionalSpeed = THREE.MathUtils.lerp(8, 12, seededRandom(serial, fragmentIndex, 1));
      const radialSpeed = THREE.MathUtils.lerp(2.5, 5, seededRandom(serial, fragmentIndex, 2));
      const lift = THREE.MathUtils.lerp(4.5, 7.5, seededRandom(serial, fragmentIndex, 3));
      setDirectionalFragmentVelocity(
        motion.velocity,
        this.scratchImpact,
        this.scratchDirection,
        snapshot.inheritedVelocity,
        directionalSpeed * outgoingBoost * motionScale,
        radialSpeed * outgoingBoost * motionScale,
        lift * motionScale,
      );
      motion.angularAxis.set(
        seededRandom(serial, fragmentIndex, 4) * 2 - 1,
        seededRandom(serial, fragmentIndex, 5) * 2 - 1,
        seededRandom(serial, fragmentIndex, 6) * 2 - 1,
      );
      if (motion.angularAxis.lengthSq() <= 0.000001) motion.angularAxis.set(0, 1, 0);
      else motion.angularAxis.normalize();
      motion.angularSpeed = THREE.MathUtils.lerp(18, 32, seededRandom(serial, fragmentIndex, 7)) * motionScale;
      motion.bounceCount = 0;
      motion.clearance = computeFragmentFloorClearance(this.fragmentRadii[fragmentIndex], motion.baseScale);

      for (const fill of this.fillsByFragment[fragmentIndex]) {
        fill.mesh.setMatrixAt(slotIndex, this.scratchMatrix);
        fill.mesh.setColorAt(slotIndex, this.scratchColor.set(snapshot.colors[fill.colorSlot]));
        if (fill.mesh.instanceColor) fill.mesh.instanceColor.needsUpdate = true;
      }
    }
    this.initializeDebris(slotIndex, slot, snapshot, serial, motionScale);
    this.markMatricesForUpdate();
    this.syncDrawCounts();
    return true;
  }

  update(deltaTime: number): void {
    if (!this.ready) return;
    let changed = false;
    for (let slotIndex = 0; slotIndex < this.slots.length; slotIndex += 1) {
      const slot = this.slots[slotIndex];
      if (!slot.active) continue;
      changed = true;
      const previousAge = slot.age;
      slot.age = Math.min(spinnerDeathVfxDuration, slot.age + deltaTime);
      const motionDelta = Math.max(0, slot.age - launchDelay) - Math.max(0, previousAge - launchDelay);
      const shrink = 1 - THREE.MathUtils.smoothstep(slot.age, shrinkStart, shrinkEnd);

      for (let fragmentIndex = 0; fragmentIndex < slot.fragments.length; fragmentIndex += 1) {
        const motion = slot.fragments[fragmentIndex];
        if (motionDelta > 0) {
          motion.velocity.y += largeFragmentGravity * motionDelta;
          motion.position.addScaledVector(motion.velocity, motionDelta);
          this.scratchQuaternion.setFromAxisAngle(motion.angularAxis, motion.angularSpeed * motionDelta);
          motion.quaternion.premultiply(this.scratchQuaternion);
          motion.angularSpeed *= Math.exp(-largeAngularDamping * motionDelta);
          const groundHeight = this.getGroundHeight(motion.position.x, motion.position.z) + motion.clearance;
          applyLargeFragmentGroundContact(motion, groundHeight, motionDelta);
        }
        this.scratchScale.copy(motion.baseScale).multiplyScalar(shrink);
        this.scratchMatrix.compose(motion.position, motion.quaternion, this.scratchScale);
        for (const fill of this.fillsByFragment[fragmentIndex]) {
          fill.mesh.setMatrixAt(slotIndex, this.scratchMatrix);
        }
      }
      this.updateDebris(slotIndex, slot, motionDelta);

      if (slot.age >= spinnerDeathVfxDuration) this.hideSlot(slotIndex);
    }
    if (!changed) return;
    this.markMatricesForUpdate();
    this.syncDrawCounts();
  }

  isActive(): boolean {
    return this.slots.some((slot) => slot.active);
  }

  reset(): void {
    for (let slotIndex = 0; slotIndex < this.slots.length; slotIndex += 1) this.hideSlot(slotIndex);
    this.markMatricesForUpdate();
    this.syncDrawCounts();
  }

  getOutlineTargets(): readonly THREE.Object3D[] {
    return this.outlineTargets;
  }

  private initializeDebris(
    slotIndex: number,
    slot: EffectSlot,
    snapshot: SpinnerDeathSnapshot,
    serial: number,
    motionScale: number,
  ): void {
    const impactAngle = Math.atan2(this.scratchImpact.z, this.scratchImpact.x);
    for (let index = 0; index < slot.debris.length; index += 1) {
      const debris = slot.debris[index];
      const seedIndex = 100 + index;
      const scatterAngle = seededRandom(serial, seedIndex, 0) * Math.PI * 2;
      const scatterRadius = seededRandom(serial, seedIndex, 1) * 0.3;
      debris.position.copy(snapshot.impactPosition);
      debris.position.x += Math.cos(scatterAngle) * scatterRadius;
      debris.position.y += seededRandom(serial, seedIndex, 2) * 0.18;
      debris.position.z += Math.sin(scatterAngle) * scatterRadius;

      const coneAngle = impactAngle + THREE.MathUtils.lerp(-0.9, 0.9, seededRandom(serial, seedIndex, 3));
      const speed = THREE.MathUtils.lerp(10, 18, seededRandom(serial, seedIndex, 4)) * motionScale;
      debris.velocity.set(Math.cos(coneAngle) * speed, 0, Math.sin(coneAngle) * speed);
      debris.velocity.addScaledVector(snapshot.inheritedVelocity, inheritedVelocityFactor);
      debris.velocity.y += THREE.MathUtils.lerp(2, 8, seededRandom(serial, seedIndex, 5)) * motionScale;

      debris.angularAxis.set(
        seededRandom(serial, seedIndex, 6) * 2 - 1,
        seededRandom(serial, seedIndex, 7) * 2 - 1,
        seededRandom(serial, seedIndex, 8) * 2 - 1,
      );
      if (debris.angularAxis.lengthSq() <= 0.000001) debris.angularAxis.set(0, 1, 0);
      else debris.angularAxis.normalize();
      debris.quaternion.setFromAxisAngle(debris.angularAxis, seededRandom(serial, seedIndex, 9) * Math.PI * 2);
      debris.angularSpeed = THREE.MathUtils.lerp(20, 45, seededRandom(serial, seedIndex, 10)) * motionScale;
      debris.age = 0;
      debris.lifetime = THREE.MathUtils.lerp(0.45, 0.95, seededRandom(serial, seedIndex, 11));
      debris.bounced = false;
      const scale = THREE.MathUtils.lerp(0.6, 1.3, seededRandom(serial, seedIndex, 12));
      debris.baseScale.set(
        scale * THREE.MathUtils.lerp(0.65, 1.35, seededRandom(serial, seedIndex, 13)),
        scale * THREE.MathUtils.lerp(0.55, 1, seededRandom(serial, seedIndex, 14)),
        scale,
      );
      const instanceIndex = slotIndex * debrisPerArchetype + debris.localIndex;
      this.scratchMatrix.compose(debris.position, debris.quaternion, debris.baseScale);
      const mesh = this.debrisMeshes[debris.archetype];
      mesh.setMatrixAt(instanceIndex, this.scratchMatrix);
      const colorSlot = Math.floor(seededRandom(serial, seedIndex, 15) * snapshot.colors.length);
      mesh.setColorAt(instanceIndex, this.scratchColor.set(snapshot.colors[colorSlot]));
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  private updateDebris(slotIndex: number, slot: EffectSlot, deltaTime: number): void {
    for (const debris of slot.debris) {
      const mesh = this.debrisMeshes[debris.archetype];
      const instanceIndex = slotIndex * debrisPerArchetype + debris.localIndex;
      if (deltaTime <= 0) continue;
      debris.age += deltaTime;
      if (debris.age >= debris.lifetime) {
        mesh.setMatrixAt(instanceIndex, hiddenMatrix);
        continue;
      }

      debris.velocity.y += debrisGravity * deltaTime;
      debris.position.addScaledVector(debris.velocity, deltaTime);
      this.scratchQuaternion.setFromAxisAngle(debris.angularAxis, debris.angularSpeed * deltaTime);
      debris.quaternion.premultiply(this.scratchQuaternion);
      debris.angularSpeed *= Math.exp(-3.2 * deltaTime);
      const floor = this.getGroundHeight(debris.position.x, debris.position.z) + 0.08;
      if (debris.position.y <= floor && debris.velocity.y < 0) {
        debris.position.y = floor;
        if (!debris.bounced) {
          debris.velocity.y = Math.abs(debris.velocity.y) * 0.25;
          debris.velocity.x *= 0.68;
          debris.velocity.z *= 0.68;
          debris.angularSpeed *= 0.6;
          debris.bounced = true;
        } else {
          debris.velocity.y = 0;
          const friction = Math.exp(-9 * deltaTime);
          debris.velocity.x *= friction;
          debris.velocity.z *= friction;
          debris.angularSpeed *= friction;
        }
      }
      const shrink = 1 - THREE.MathUtils.smoothstep(debris.age, debris.lifetime * 0.7, debris.lifetime);
      this.scratchScale.copy(debris.baseScale).multiplyScalar(shrink);
      this.scratchMatrix.compose(debris.position, debris.quaternion, this.scratchScale);
      mesh.setMatrixAt(instanceIndex, this.scratchMatrix);
    }
  }

  private createDebrisMeshes(): [THREE.InstancedMesh, THREE.InstancedMesh] {
    const tetrahedron = new THREE.TetrahedronGeometry(0.16, 0);
    const wedge = new THREE.ConeGeometry(0.13, 0.32, 3);
    wedge.rotateZ(Math.PI / 2);
    return [
      this.createDebrisMesh(tetrahedron, "Spinner Death Small Tetra Debris"),
      this.createDebrisMesh(wedge, "Spinner Death Small Wedge Debris"),
    ];
  }

  private createDebrisMesh(geometry: THREE.BufferGeometry, name: string): THREE.InstancedMesh {
    geometry.computeVertexNormals();
    const material = new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false });
    const mesh = new THREE.InstancedMesh(geometry, material, this.capacity * debrisPerArchetype);
    mesh.name = name;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    mesh.count = 0;
    for (let instanceIndex = 0; instanceIndex < this.capacity * debrisPerArchetype; instanceIndex += 1) {
      mesh.setMatrixAt(instanceIndex, hiddenMatrix);
      mesh.setColorAt(instanceIndex, this.scratchColor.set("#ffffff"));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.scene.add(mesh);
    return mesh;
  }

  private hideSlot(slotIndex: number): void {
    const slot = this.slots[slotIndex];
    slot.active = false;
    slot.age = 0;
    for (const fill of this.allFills) fill.mesh.setMatrixAt(slotIndex, hiddenMatrix);
    for (const debris of slot.debris) {
      const instanceIndex = slotIndex * debrisPerArchetype + debris.localIndex;
      this.debrisMeshes[debris.archetype].setMatrixAt(instanceIndex, hiddenMatrix);
    }
  }

  private markMatricesForUpdate(): void {
    for (const fill of this.allFills) fill.mesh.instanceMatrix.needsUpdate = true;
    for (const mesh of this.debrisMeshes) mesh.instanceMatrix.needsUpdate = true;
  }

  private syncDrawCounts(): void {
    let count = 0;
    for (let index = this.slots.length - 1; index >= 0; index -= 1) {
      if (!this.slots[index].active) continue;
      count = index + 1;
      break;
    }
    for (const fill of this.allFills) fill.mesh.count = count;
    for (const mesh of this.debrisMeshes) mesh.count = count * debrisPerArchetype;
  }

  private disposeFills(): void {
    for (const fill of this.allFills) {
      this.scene.remove(fill.mesh);
      fill.mesh.geometry.dispose();
      const materials = Array.isArray(fill.mesh.material) ? fill.mesh.material : [fill.mesh.material];
      for (const material of materials) material.dispose();
    }
    this.allFills.length = 0;
    this.outlineTargets.length = 0;
    for (const fills of this.fillsByFragment) fills.length = 0;
    this.ready = false;
  }
}

export function validateSpinnerDeathFragments(root: THREE.Object3D): THREE.Object3D[] {
  const byName = new Map<string, THREE.Object3D[]>();
  root.traverse((object) => {
    if (!/^fragment_\d+$/i.test(object.name)) return;
    const matches = byName.get(object.name) ?? [];
    matches.push(object);
    byName.set(object.name, matches);
  });
  const fragments = spinnerDeathFragmentNames.map((name) => byName.get(name)?.[0]);
  const missing = spinnerDeathFragmentNames.filter((_, index) => !fragments[index]);
  if (missing.length > 0) throw new Error(`Spinner destruction model is missing: ${missing.join(", ")}`);
  const expectedNames = new Set<string>(spinnerDeathFragmentNames);
  const unexpected = [...byName.keys()].filter((name) => !expectedNames.has(name));
  const duplicates = [...byName.entries()].filter(([, matches]) => matches.length > 1).map(([name]) => name);
  if (unexpected.length > 0 || duplicates.length > 0) {
    throw new Error(`Spinner destruction model has invalid fragments: ${[...unexpected, ...duplicates].join(", ")}`);
  }
  return fragments as THREE.Object3D[];
}

function resolveColorSlot(materialName: string): 0 | 1 | 2 {
  if (/^m_color_2$/i.test(materialName.trim())) return 1;
  if (/^m_base$/i.test(materialName.trim())) return 2;
  return 0;
}

function seededRandom(serial: number, fragmentIndex: number, channel: number): number {
  const value = Math.sin((serial + 1) * 127.1 + (fragmentIndex + 1) * 311.7 + channel * 74.7) * 43758.5453;
  return value - Math.floor(value);
}

export function setDirectionalFragmentVelocity(
  output: THREE.Vector3,
  impactDirection: THREE.Vector3,
  radialDirection: THREE.Vector3,
  inheritedVelocity: THREE.Vector3,
  directionalSpeed: number,
  radialSpeed: number,
  lift: number,
): THREE.Vector3 {
  output.copy(impactDirection).multiplyScalar(directionalSpeed);
  output.addScaledVector(radialDirection, radialSpeed);
  output.addScaledVector(inheritedVelocity, inheritedVelocityFactor);
  output.y += lift;
  return output;
}

export function computeFragmentFloorClearance(radius: number, scale: THREE.Vector3): number {
  return Math.max(0.03, radius * Math.max(Math.abs(scale.x), Math.abs(scale.y), Math.abs(scale.z)) * 0.55);
}

export type LargeFragmentGroundMotion = {
  position: { y: number };
  velocity: { x: number; y: number; z: number };
  angularSpeed: number;
  bounceCount: number;
};

export function applyLargeFragmentGroundContact(
  motion: LargeFragmentGroundMotion,
  groundHeight: number,
  deltaTime: number,
): boolean {
  if (motion.position.y > groundHeight || motion.velocity.y >= 0) return false;
  motion.position.y = groundHeight;
  if (motion.bounceCount === 0) {
    motion.velocity.y = Math.abs(motion.velocity.y) * 0.38;
    motion.velocity.x *= 0.82;
    motion.velocity.z *= 0.82;
    motion.angularSpeed *= 0.72;
    motion.bounceCount = 1;
    return true;
  }
  if (motion.bounceCount === 1) {
    motion.velocity.y = Math.abs(motion.velocity.y) * 0.2;
    motion.velocity.x *= 0.58;
    motion.velocity.z *= 0.58;
    motion.angularSpeed *= 0.45;
    motion.bounceCount = 2;
    return true;
  }
  motion.velocity.y = 0;
  const friction = Math.exp(-7 * deltaTime);
  motion.velocity.x *= friction;
  motion.velocity.z *= friction;
  motion.angularSpeed *= Math.exp(-9 * deltaTime);
  return true;
}

export class DeathCameraPunch {
  private readonly direction = new THREE.Vector3(1, 0, 0);
  private readonly previousOffset = new THREE.Vector3();
  private age = 1;
  private amplitude = 0;

  trigger(impactDirection: THREE.Vector3, reducedMotion: boolean): void {
    if (reducedMotion) {
      this.age = 1;
      this.amplitude = 0;
      return;
    }
    this.direction.copy(impactDirection).setY(0);
    if (this.direction.lengthSq() <= 0.000001) this.direction.set(1, 0, 0);
    else this.direction.normalize();
    this.age = 0;
    this.amplitude = 0.22;
  }

  remove(camera: THREE.Camera): void {
    camera.position.sub(this.previousOffset);
    this.previousOffset.set(0, 0, 0);
  }

  updateAndApply(camera: THREE.Camera, deltaTime: number): void {
    if (this.age >= 0.18) return;
    this.age = Math.min(0.18, this.age + deltaTime);
    const progress = this.age / 0.18;
    const envelope = (1 - progress) ** 2;
    const oscillation = Math.cos(progress * Math.PI * 3);
    this.previousOffset.copy(this.direction).multiplyScalar(-this.amplitude * envelope * oscillation);
    this.previousOffset.y = this.amplitude * 0.28 * envelope * Math.sin(progress * Math.PI * 2);
    camera.position.add(this.previousOffset);
  }

  reset(camera: THREE.Camera): void {
    this.remove(camera);
    this.age = 1;
    this.amplitude = 0;
  }
}
