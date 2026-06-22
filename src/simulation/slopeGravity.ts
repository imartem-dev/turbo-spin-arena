import * as THREE from "three";

export type HeightSampler = (x: number, z: number) => number;

export type SlopeGravitySettings = {
  slopeGravity: number;
  maxSlopeBoost: number;
  slopeSampleDistance: number;
};

export type RimResistanceSettings = {
  rimResistanceStartRatio: number;
  rimResistanceStrength: number;
  rimResistanceMaxBoost: number;
};

export function sampleHeightGradient(
  position: THREE.Vector3,
  getHeightAt: HeightSampler,
  sampleDistance: number,
): THREE.Vector2 {
  const distance = Math.max(sampleDistance, 0.0001);
  const heightRight = getHeightAt(position.x + distance, position.z);
  const heightLeft = getHeightAt(position.x - distance, position.z);
  const heightForward = getHeightAt(position.x, position.z + distance);
  const heightBack = getHeightAt(position.x, position.z - distance);

  return new THREE.Vector2(
    (heightRight - heightLeft) / (distance * 2),
    (heightForward - heightBack) / (distance * 2),
  );
}

export function applySlopeGravity(
  velocity: THREE.Vector3,
  position: THREE.Vector3,
  getHeightAt: HeightSampler,
  settings: SlopeGravitySettings,
  deltaTime: number,
): void {
  if (settings.slopeGravity <= 0 || deltaTime <= 0) {
    return;
  }

  const gradient = sampleHeightGradient(position, getHeightAt, settings.slopeSampleDistance);
  if (gradient.lengthSq() <= 0.000001) {
    return;
  }

  velocity.x -= gradient.x * settings.slopeGravity * deltaTime;
  velocity.z -= gradient.y * settings.slopeGravity * deltaTime;
}

export function applyRimResistance(
  velocity: THREE.Vector3,
  position: THREE.Vector3,
  arenaRadius: number,
  settings: RimResistanceSettings,
  deltaTime: number,
): void {
  if (settings.rimResistanceStrength <= 0 || deltaTime <= 0 || arenaRadius <= 0) {
    return;
  }

  const distanceFromCenter = Math.hypot(position.x, position.z);
  const startDistance = arenaRadius * settings.rimResistanceStartRatio;
  if (distanceFromCenter <= startDistance || distanceFromCenter <= 0.000001) {
    return;
  }

  const resistanceRange = Math.max(arenaRadius - startDistance, 0.0001);
  const resistanceRatio = Math.min((distanceFromCenter - startDistance) / resistanceRange, 1);
  const inwardAcceleration = settings.rimResistanceStrength * resistanceRatio;

  velocity.x -= (position.x / distanceFromCenter) * inwardAcceleration * deltaTime;
  velocity.z -= (position.z / distanceFromCenter) * inwardAcceleration * deltaTime;
}
