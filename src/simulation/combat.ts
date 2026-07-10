import * as THREE from "three";
import { getCriticalSpeed } from "./movement";

export type CombatSpinnerState = {
  name: string;
  group: THREE.Group;
  velocity: THREE.Vector3;
  forwardDirection: THREE.Vector3;
  radius: number;
  pulseTimer: number;
  currentRPM: number;
  maxRPM: number;
  absoluteMaxRPM: number;
  baseMoveSpeed: number;
  critSpeedEase?: number;
  critDamageMultiplier?: number;
  damageMultiplier?: number;
  incomingDamageMultiplier?: number;
  collisionDamageMultiplier?: number;
  collisionKnockbackMultiplier?: number;
  elementalMoveSpeedMultiplier?: number;
  elementalMovementLocked?: boolean;
  verticalLaunchActive?: boolean;
};

export type CombatImpact = {
  position: THREE.Vector3;
  normal: THREE.Vector3;
  critical: boolean;
};

export type CombatKnockbackCommand<TSpinner extends CombatSpinnerState = CombatSpinnerState> = {
  spinner: TSpinner;
  direction: THREE.Vector3;
  distance: number;
  duration: number;
};

export type CombatFlashStep = {
  color: string;
  duration: number;
};

export type CombatFlashCommand<TSpinner extends CombatSpinnerState = CombatSpinnerState> = {
  spinner: TSpinner;
  sequence: CombatFlashStep[];
};

export type CombatDamageNumberCommand<TSpinner extends CombatSpinnerState = CombatSpinnerState> = {
  source: TSpinner;
  target: TSpinner;
  amount: number;
  critical: boolean;
  direction: THREE.Vector3;
};

export type CombatDamageEvent<TSpinner extends CombatSpinnerState = CombatSpinnerState> = {
  source: TSpinner;
  target: TSpinner;
  amount: number;
  critical: boolean;
  position: THREE.Vector3;
  direction: THREE.Vector3;
};

export type DirectDamageResult<TSpinner extends CombatSpinnerState = CombatSpinnerState> = {
  damageEvent: CombatDamageEvent<TSpinner> | null;
  damageNumber: CombatDamageNumberCommand<TSpinner> | null;
};

export type CombatCollisionResult<TSpinner extends CombatSpinnerState = CombatSpinnerState> = {
  impacts: CombatImpact[];
  knockbacks: CombatKnockbackCommand<TSpinner>[];
  flashes: CombatFlashCommand<TSpinner>[];
  damageNumbers: CombatDamageNumberCommand<TSpinner>[];
  damageEvents: CombatDamageEvent<TSpinner>[];
};

type ContactZone = "front" | "side" | "back";

type CollisionSnapshot<TSpinner extends CombatSpinnerState = CombatSpinnerState> = {
  spinner: TSpinner;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  forwardDirection: THREE.Vector3;
};

type DamageAccumulator = {
  damageTaken: number;
  damageDealt: number;
};

type CollisionDamage = {
  damageToA: number;
  damageToB: number;
  aCritsB: boolean;
  bCritsA: boolean;
};

type DamageNumberCandidate<TSpinner extends CombatSpinnerState = CombatSpinnerState> = {
  source: TSpinner;
  target: TSpinner;
  amount: number;
  critical: boolean;
  direction: THREE.Vector3;
};

const referenceMaxRPM = 6000;
const baseMaxPersonalHitDamageRatio = 0.25;
const referenceMaxHitSpeed = 17;
const damagePerSpeed = (referenceMaxRPM * baseMaxPersonalHitDamageRatio) / referenceMaxHitSpeed;
const minImpactSpeedForDamage = 0.6;
const impactDamageCooldown = 0.16;
const criticalDamageMultiplier = 1.5;
const knockbackDuration = 0.5;
const equalHitKnockbackRadii = 4.2;
const winnerKnockbackRadii = 1.5;
const loserKnockbackRadii = 7.5;
const criticalTargetKnockbackRadii = 12;
const criticalAttackerKnockbackRadii = 0;
const loserFlashSequence: CombatFlashStep[] = [{ color: "#ff0000", duration: 0.12 }];
const criticalTargetFlashSequence: CombatFlashStep[] = [
  { color: "#ffffff", duration: 0.06 },
  { color: "#ff0000", duration: 0.12 },
  { color: "#ffffff", duration: 0.06 },
];
const pairImpactTimes = new Map<string, number>();

export function resetCombatState(): void {
  pairImpactTimes.clear();
}

export function handleSpinnerCollisions<TSpinner extends CombatSpinnerState>(
  spinners: TSpinner[],
  elapsedTime: number,
): CombatCollisionResult<TSpinner> {
  const snapshots = spinners.map((spinner) => ({
    spinner,
    position: spinner.group.position.clone(),
    velocity: spinner.velocity.clone(),
    forwardDirection: spinner.forwardDirection.clone(),
  }));
  const damageBySpinner = new Map<TSpinner, DamageAccumulator>();
  const impacts: CombatImpact[] = [];
  const knockbacks: CombatKnockbackCommand<TSpinner>[] = [];
  const flashes: CombatFlashCommand<TSpinner>[] = [];
  const damageNumberCandidates: DamageNumberCandidate<TSpinner>[] = [];
  const damageEvents: CombatDamageEvent<TSpinner>[] = [];

  for (const spinner of spinners) {
    damageBySpinner.set(spinner, { damageTaken: 0, damageDealt: 0 });
  }

  for (let aIndex = 0; aIndex < snapshots.length - 1; aIndex += 1) {
    for (let bIndex = aIndex + 1; bIndex < snapshots.length; bIndex += 1) {
      handleSpinnerCollisionPair(
        snapshots[aIndex],
        snapshots[bIndex],
        damageBySpinner,
        impacts,
        knockbacks,
        flashes,
        damageNumberCandidates,
        damageEvents,
        elapsedTime,
      );
    }
  }

  const maxRpmLossBySpinner = applyAccumulatedDamage(damageBySpinner);
  const damageNumbers = createDamageNumberCommands(damageNumberCandidates, maxRpmLossBySpinner);
  return { impacts, knockbacks, flashes, damageNumbers, damageEvents };
}

function handleSpinnerCollisionPair<TSpinner extends CombatSpinnerState>(
  a: CollisionSnapshot<TSpinner>,
  b: CollisionSnapshot<TSpinner>,
  damageBySpinner: Map<TSpinner, DamageAccumulator>,
  impacts: CombatImpact[],
  knockbacks: CombatKnockbackCommand<TSpinner>[],
  flashes: CombatFlashCommand<TSpinner>[],
  damageNumberCandidates: DamageNumberCandidate<TSpinner>[],
  damageEvents: CombatDamageEvent<TSpinner>[],
  elapsedTime: number,
): void {
  if (a.spinner.verticalLaunchActive || b.spinner.verticalLaunchActive) {
    return;
  }

  const offset = new THREE.Vector3().subVectors(b.position, a.position);
  offset.y = 0;
  const distance = offset.length();
  const minDistance = a.spinner.radius + b.spinner.radius;
  if (distance >= minDistance) {
    return;
  }

  const normal = distance > 0.001 ? offset.divideScalar(distance) : new THREE.Vector3(1, 0, 0);
  const penetration = minDistance - distance;
  const aLocked = a.spinner.elementalMovementLocked === true;
  const bLocked = b.spinner.elementalMovementLocked === true;
  if (aLocked && !bLocked) {
    b.spinner.group.position.addScaledVector(normal, penetration);
  } else if (!aLocked && bLocked) {
    a.spinner.group.position.addScaledVector(normal, -penetration);
  } else if (!aLocked && !bLocked) {
    a.spinner.group.position.addScaledVector(normal, -penetration * 0.5);
    b.spinner.group.position.addScaledVector(normal, penetration * 0.5);
  }

  const relativeVelocity = new THREE.Vector3().subVectors(a.velocity, b.velocity);
  const impactSpeed = Math.max(0, relativeVelocity.dot(normal));
  const aHitSpeed = Math.max(0, a.velocity.dot(normal));
  const bHitSpeed = Math.max(0, -b.velocity.dot(normal));
  const aCriticalSpeed = getCriticalSpeed(a.spinner);
  const bCriticalSpeed = getCriticalSpeed(b.spinner);
  const pairKey = getCollisionPairKey(a.spinner, b.spinner);
  const lastImpactTime = pairImpactTimes.get(pairKey) ?? -Infinity;
  const canApplyDamage = impactSpeed >= minImpactSpeedForDamage && elapsedTime - lastImpactTime >= impactDamageCooldown;
  const aZone = getContactZone(a.forwardDirection, normal);
  const bZone = getContactZone(b.forwardDirection, normal.clone().multiplyScalar(-1));
  const impactPosition = a.position.clone().add(b.position).multiplyScalar(0.5);
  let damage: CollisionDamage = { damageToA: 0, damageToB: 0, aCritsB: false, bCritsA: false };
  let showImpactFeedback = false;

  if (canApplyDamage) {
    damage = getCollisionDamage(a.spinner, b.spinner, aZone, bZone, aHitSpeed, bHitSpeed, aCriticalSpeed, bCriticalSpeed);

    addDamage(damageBySpinner, a.spinner, damage.damageToA, damage.damageToB);
    addDamage(damageBySpinner, b.spinner, damage.damageToB, damage.damageToA);
    addDamageEvent(damageEvents, a.spinner, b.spinner, damage.damageToB, damage.aCritsB, impactPosition, normal);
    addDamageEvent(
      damageEvents,
      b.spinner,
      a.spinner,
      damage.damageToA,
      damage.bCritsA,
      impactPosition,
      normal.clone().multiplyScalar(-1),
    );
    pairImpactTimes.set(pairKey, elapsedTime);
    showImpactFeedback = true;
  }

  if (showImpactFeedback) {
    const criticalHit = damage.aCritsB || damage.bCritsA;
    a.spinner.pulseTimer = criticalHit ? 0.28 : 0.18;
    b.spinner.pulseTimer = criticalHit ? 0.28 : 0.18;
    addKnockbackCommand(knockbacks, a.spinner, normal.clone().multiplyScalar(-1), damage.damageToA, damage.damageToB, damage.aCritsB, damage.bCritsA, b.spinner.collisionKnockbackMultiplier ?? 1);
    addKnockbackCommand(knockbacks, b.spinner, normal.clone(), damage.damageToB, damage.damageToA, damage.bCritsA, damage.aCritsB, a.spinner.collisionKnockbackMultiplier ?? 1);
    addFlashCommand(flashes, a.spinner, damage.damageToA, damage.damageToB, damage.bCritsA);
    addFlashCommand(flashes, b.spinner, damage.damageToB, damage.damageToA, damage.aCritsB);
    addDamageNumberCandidate(damageNumberCandidates, b.spinner, a.spinner, damage.damageToA, damage.bCritsA, normal.clone().multiplyScalar(-1));
    addDamageNumberCandidate(damageNumberCandidates, a.spinner, b.spinner, damage.damageToB, damage.aCritsB, normal.clone());
    impacts.push({
      position: impactPosition,
      normal: normal.clone(),
      critical: criticalHit,
    });
  }
}

function getCollisionDamage(
  aSpinner: CombatSpinnerState,
  bSpinner: CombatSpinnerState,
  aZone: ContactZone,
  bZone: ContactZone,
  aHitSpeed: number,
  bHitSpeed: number,
  aCriticalSpeed: number,
  bCriticalSpeed: number,
): CollisionDamage {
  let damageToB = aHitSpeed * damagePerSpeed * getOutgoingMultiplier(aZone) * getIncomingMultiplier(bZone)
    * (aSpinner.damageMultiplier ?? 1) * (aSpinner.collisionDamageMultiplier ?? 1) * (bSpinner.incomingDamageMultiplier ?? 1);
  let damageToA = bHitSpeed * damagePerSpeed * getOutgoingMultiplier(bZone) * getIncomingMultiplier(aZone)
    * (bSpinner.damageMultiplier ?? 1) * (bSpinner.collisionDamageMultiplier ?? 1) * (aSpinner.incomingDamageMultiplier ?? 1);
  const aCritsB = isCriticalHit(aZone, bZone, aHitSpeed, aCriticalSpeed);
  const bCritsA = isCriticalHit(bZone, aZone, bHitSpeed, bCriticalSpeed);

  if (aCritsB) {
    damageToB *= criticalDamageMultiplier * (aSpinner.critDamageMultiplier ?? 1);
  }
  if (bCritsA) {
    damageToA *= criticalDamageMultiplier * (bSpinner.critDamageMultiplier ?? 1);
  }

  return { damageToA, damageToB, aCritsB, bCritsA };
}

function addKnockbackCommand<TSpinner extends CombatSpinnerState>(
  knockbacks: CombatKnockbackCommand<TSpinner>[],
  spinner: TSpinner,
  direction: THREE.Vector3,
  damageTaken: number,
  damageDealt: number,
  dealtCritical: boolean,
  receivedCritical: boolean,
  distanceMultiplier: number,
): void {
  let distanceRadii = equalHitKnockbackRadii;
  if (receivedCritical) {
    distanceRadii = criticalTargetKnockbackRadii;
  } else if (dealtCritical) {
    distanceRadii = criticalAttackerKnockbackRadii;
  } else if (damageTaken > damageDealt) {
    distanceRadii = loserKnockbackRadii;
  } else if (damageDealt > damageTaken) {
    distanceRadii = winnerKnockbackRadii;
  }

  const distance = spinner.radius * distanceRadii * distanceMultiplier;
  if (distance <= 0) {
    return;
  }

  knockbacks.push({
    spinner,
    direction: direction.normalize(),
    distance,
    duration: knockbackDuration,
  });
}

function addDamageNumberCandidate<TSpinner extends CombatSpinnerState>(
  damageNumbers: DamageNumberCandidate<TSpinner>[],
  source: TSpinner,
  target: TSpinner,
  amount: number,
  critical: boolean,
  direction: THREE.Vector3,
): void {
  if (amount <= 0) {
    return;
  }

  damageNumbers.push({
    source,
    target,
    amount,
    critical,
    direction: direction.normalize(),
  });
}

function createDamageNumberCommands<TSpinner extends CombatSpinnerState>(
  candidates: DamageNumberCandidate<TSpinner>[],
  maxRpmLossBySpinner: Map<TSpinner, number>,
): CombatDamageNumberCommand<TSpinner>[] {
  const bestCandidateByTarget = new Map<TSpinner, DamageNumberCandidate<TSpinner>>();
  for (const candidate of candidates) {
    const current = bestCandidateByTarget.get(candidate.target);
    if (!current || candidate.amount > current.amount) {
      bestCandidateByTarget.set(candidate.target, candidate);
    }
  }

  const damageNumbers: CombatDamageNumberCommand<TSpinner>[] = [];
  for (const [target, maxRpmLoss] of maxRpmLossBySpinner) {
    if (maxRpmLoss <= 0) {
      continue;
    }

    const candidate = bestCandidateByTarget.get(target);
    if (!candidate) {
      continue;
    }

    damageNumbers.push({
      source: candidate.source,
      target,
      amount: maxRpmLoss,
      critical: candidate.critical,
      direction: candidate.direction.clone(),
    });
  }
  return damageNumbers;
}

function addFlashCommand<TSpinner extends CombatSpinnerState>(
  flashes: CombatFlashCommand<TSpinner>[],
  spinner: TSpinner,
  damageTaken: number,
  damageDealt: number,
  receivedCritical: boolean,
): void {
  if (receivedCritical) {
    flashes.push({ spinner, sequence: criticalTargetFlashSequence });
    return;
  }

  if (damageTaken > damageDealt) {
    flashes.push({ spinner, sequence: loserFlashSequence });
  }
}

function addDamage<TSpinner extends CombatSpinnerState>(
  damageBySpinner: Map<TSpinner, DamageAccumulator>,
  spinner: TSpinner,
  damageTaken: number,
  damageDealt: number,
): void {
  const accumulator = damageBySpinner.get(spinner);
  if (!accumulator) {
    return;
  }
  accumulator.damageTaken += damageTaken;
  accumulator.damageDealt += damageDealt;
}

function addDamageEvent<TSpinner extends CombatSpinnerState>(
  damageEvents: CombatDamageEvent<TSpinner>[],
  source: TSpinner,
  target: TSpinner,
  amount: number,
  critical: boolean,
  position: THREE.Vector3,
  direction: THREE.Vector3,
): void {
  if (amount <= 0) {
    return;
  }

  damageEvents.push({
    source,
    target,
    amount,
    critical,
    position: position.clone(),
    direction: direction.clone().normalize(),
  });
}

export function applyDirectDamage<TSpinner extends CombatSpinnerState>(
  source: TSpinner,
  target: TSpinner,
  baseAmount: number,
  direction: THREE.Vector3,
): DirectDamageResult<TSpinner> {
  const amount = Math.min(
    baseAmount * (source.damageMultiplier ?? 1) * (target.incomingDamageMultiplier ?? 1),
    target.maxRPM,
  );
  if (amount <= 0) {
    return { damageEvent: null, damageNumber: null };
  }

  target.maxRPM = Math.max(0, target.maxRPM - amount);
  target.currentRPM = Math.min(Math.max(0, target.currentRPM - amount), target.maxRPM);

  const normalizedDirection = direction.clone();
  normalizedDirection.y = 0;
  if (normalizedDirection.lengthSq() <= 0.000001) {
    normalizedDirection.copy(target.forwardDirection);
    normalizedDirection.y = 0;
  }
  if (normalizedDirection.lengthSq() <= 0.000001) {
    normalizedDirection.set(1, 0, 0);
  }
  normalizedDirection.normalize();

  const position = target.group.position.clone();
  return {
    damageEvent: {
      source,
      target,
      amount,
      critical: false,
      position,
      direction: normalizedDirection.clone(),
    },
    damageNumber: {
      source,
      target,
      amount,
      critical: false,
      direction: normalizedDirection,
    },
  };
}

function applyAccumulatedDamage<TSpinner extends CombatSpinnerState>(
  damageBySpinner: Map<TSpinner, DamageAccumulator>,
): Map<TSpinner, number> {
  const maxRpmLossBySpinner = new Map<TSpinner, number>();
  for (const [spinner, damage] of damageBySpinner) {
    if (damage.damageTaken <= 0) {
      continue;
    }

    spinner.currentRPM = Math.max(0, spinner.currentRPM - damage.damageTaken);
    const damageDeficit = damage.damageTaken - damage.damageDealt;
    if (damageDeficit > 0) {
      const maxRpmLoss = damageDeficit;
      const previousMaxRPM = spinner.maxRPM;
      spinner.maxRPM = Math.max(0, spinner.maxRPM - maxRpmLoss);
      maxRpmLossBySpinner.set(spinner, previousMaxRPM - spinner.maxRPM);
    }
    spinner.currentRPM = Math.min(spinner.currentRPM, spinner.maxRPM);
  }
  return maxRpmLossBySpinner;
}

function getCollisionPairKey(a: CombatSpinnerState, b: CombatSpinnerState): string {
  return a.name < b.name ? `${a.name}:${b.name}` : `${b.name}:${a.name}`;
}

function getContactZone(forwardDirection: THREE.Vector3, directionToOther: THREE.Vector3): ContactZone {
  const dot = forwardDirection.dot(directionToOther);
  if (dot > 0.5) {
    return "front";
  }
  if (dot < -0.5) {
    return "back";
  }
  return "side";
}

function getOutgoingMultiplier(zone: ContactZone): number {
  if (zone === "front") {
    return 1;
  }
  if (zone === "back") {
    return 0.2;
  }
  return 0.8;
}

function getIncomingMultiplier(zone: ContactZone): number {
  if (zone === "front") {
    return 0.75;
  }
  if (zone === "back") {
    return 1.3;
  }
  return 1;
}

function isCriticalHit(
  attackerZone: ContactZone,
  targetZone: ContactZone,
  hitSpeed: number,
  criticalSpeed: number,
): boolean {
  return attackerZone === "front" && targetZone !== "front" && hitSpeed >= criticalSpeed;
}
