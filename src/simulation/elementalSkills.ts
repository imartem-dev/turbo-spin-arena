import * as THREE from "three";
import type { CombatSpinnerState } from "./combat";

export type SpinnerElement = "fire" | "ice" | "earth" | "lightning";

export type ElementalSkillSettings = {
  auraRadius: number;
  fireDamageMultiplier: number;
  fireKnockbackMultiplier: number;
  frostSlowDuration: number;
  frostFreezeDuration: number;
  frostFragileDamageMultiplier: number;
  lightningChainRadius: number;
  lightningMaxTargets: number;
  lightningBaseDamage: number;
  lightningDamageStep: number;
  earthDamage: number;
  earthSecondPulseDelay: number;
  earthLaunchVelocity: number;
};

export const defaultElementalSkillSettings: ElementalSkillSettings = {
  auraRadius: 4,
  fireDamageMultiplier: 1.25,
  fireKnockbackMultiplier: 1.5,
  frostSlowDuration: 3,
  frostFreezeDuration: 3,
  frostFragileDamageMultiplier: 2,
  lightningChainRadius: 5,
  lightningMaxTargets: 4,
  lightningBaseDamage: 300,
  lightningDamageStep: 100,
  earthDamage: 300,
  earthSecondPulseDelay: 3,
  earthLaunchVelocity: 7,
};

export type ElementalDirectDamageCommand<TSpinner extends CombatSpinnerState> = {
  source: TSpinner;
  target: TSpinner;
  amount: number;
  direction: THREE.Vector3;
};

export type ElementalLaunchCommand<TSpinner extends CombatSpinnerState> = {
  target: TSpinner;
  verticalVelocity: number;
};

export type ElementalFreezeCommand<TSpinner extends CombatSpinnerState> = {
  target: TSpinner;
  frozen: boolean;
};

export type ElementalSkillResult<TSpinner extends CombatSpinnerState> = {
  damageCommands: ElementalDirectDamageCommand<TSpinner>[];
  launchCommands: ElementalLaunchCommand<TSpinner>[];
  freezeCommands: ElementalFreezeCommand<TSpinner>[];
  rockRipplePositions: THREE.Vector3[];
};

type FrostStatus = {
  exposure: number;
  freezeTimeRemaining: number;
  visuallyFrozen: boolean;
};

export type ElementalSkillState<TSpinner extends CombatSpinnerState> = {
  activeElement: SpinnerElement | null;
  earthSecondPulseRemaining: number | null;
  frostStatusByTarget: Map<TSpinner, FrostStatus>;
};

export function createElementalSkillState<TSpinner extends CombatSpinnerState>(): ElementalSkillState<TSpinner> {
  return {
    activeElement: null,
    earthSecondPulseRemaining: null,
    frostStatusByTarget: new Map(),
  };
}

export function syncElementalCollisionModifiers(
  source: CombatSpinnerState,
  element: SpinnerElement,
  auraActive: boolean,
  settings: ElementalSkillSettings = defaultElementalSkillSettings,
): void {
  const fireActive = auraActive && element === "fire";
  source.collisionDamageMultiplier = fireActive ? settings.fireDamageMultiplier : 1;
  source.collisionKnockbackMultiplier = fireActive ? settings.fireKnockbackMultiplier : 1;
}

export function activateElementalSkill<TSpinner extends CombatSpinnerState>(
  state: ElementalSkillState<TSpinner>,
  source: TSpinner,
  targets: readonly TSpinner[],
  element: SpinnerElement,
  isDamageable: (target: TSpinner) => boolean,
  settings: ElementalSkillSettings = defaultElementalSkillSettings,
): ElementalSkillResult<TSpinner> {
  state.activeElement = element;
  state.earthSecondPulseRemaining = null;
  const result = createEmptyResult<TSpinner>();

  if (element === "ice") {
    for (const target of targets) {
      if (!isDamageable(target) || !isInsideAura(source, target, settings.auraRadius)) {
        continue;
      }
      const status = getFrostStatus(state, target);
      status.exposure = 0;
      status.freezeTimeRemaining = settings.frostFreezeDuration;
      setFrozen(target, settings);
      if (!status.visuallyFrozen) {
        status.visuallyFrozen = true;
        result.freezeCommands.push({ target, frozen: true });
      }
    }
  } else if (element === "earth") {
    addEarthPulse(result, source, targets, isDamageable, settings);
    state.earthSecondPulseRemaining = settings.earthSecondPulseDelay;
  }

  return result;
}

export function updateElementalSkills<TSpinner extends CombatSpinnerState>(
  state: ElementalSkillState<TSpinner>,
  source: TSpinner,
  targets: readonly TSpinner[],
  auraActive: boolean,
  deltaTime: number,
  isDamageable: (target: TSpinner) => boolean,
  settings: ElementalSkillSettings = defaultElementalSkillSettings,
): ElementalSkillResult<TSpinner> {
  const result = createEmptyResult<TSpinner>();
  const iceAuraActive = auraActive && state.activeElement === "ice";

  for (const target of targets) {
    const status = getFrostStatus(state, target);
    if (!isDamageable(target)) {
      clearFrostStatus(target, status, result);
      continue;
    }

    if (status.freezeTimeRemaining > 0) {
      status.freezeTimeRemaining = Math.max(0, status.freezeTimeRemaining - deltaTime);
      if (status.freezeTimeRemaining > 0) {
        setFrozen(target, settings);
        continue;
      }
      target.incomingDamageMultiplier = 1;
      target.elementalMoveSpeedMultiplier = 1;
      target.elementalMovementLocked = false;
      if (status.visuallyFrozen) {
        status.visuallyFrozen = false;
        result.freezeCommands.push({ target, frozen: false });
      }
    }

    const insideAura = iceAuraActive && isInsideAura(source, target, settings.auraRadius);
    const exposureStep = settings.frostSlowDuration > 0 ? deltaTime / settings.frostSlowDuration : 1;
    status.exposure = THREE.MathUtils.clamp(status.exposure + (insideAura ? exposureStep : -exposureStep), 0, 1);
    target.incomingDamageMultiplier = 1;
    target.elementalMoveSpeedMultiplier = 1 - status.exposure;

    if (insideAura && status.exposure >= 1) {
      status.exposure = 0;
      status.freezeTimeRemaining = settings.frostFreezeDuration;
      setFrozen(target, settings);
      if (!status.visuallyFrozen) {
        status.visuallyFrozen = true;
        result.freezeCommands.push({ target, frozen: true });
      }
    }
  }

  if (state.earthSecondPulseRemaining !== null) {
    if (!auraActive || state.activeElement !== "earth") {
      state.earthSecondPulseRemaining = null;
    } else {
      state.earthSecondPulseRemaining -= deltaTime;
      if (state.earthSecondPulseRemaining <= 0) {
        state.earthSecondPulseRemaining = null;
        addEarthPulse(result, source, targets, isDamageable, settings);
      }
    }
  }

  if (!auraActive) {
    state.activeElement = null;
  }
  return result;
}

export function clearElementalTarget<TSpinner extends CombatSpinnerState>(
  state: ElementalSkillState<TSpinner>,
  target: TSpinner,
): boolean {
  const status = state.frostStatusByTarget.get(target);
  const wasFrozen = status?.visuallyFrozen ?? false;
  target.incomingDamageMultiplier = 1;
  target.elementalMoveSpeedMultiplier = 1;
  target.elementalMovementLocked = false;
  state.frostStatusByTarget.delete(target);
  return wasFrozen;
}

export function resetElementalSkillState<TSpinner extends CombatSpinnerState>(
  state: ElementalSkillState<TSpinner>,
  targets: readonly TSpinner[],
): TSpinner[] {
  const frozenTargets: TSpinner[] = [];
  for (const target of targets) {
    if (clearElementalTarget(state, target)) {
      frozenTargets.push(target);
    }
  }
  state.activeElement = null;
  state.earthSecondPulseRemaining = null;
  return frozenTargets;
}

function addEarthPulse<TSpinner extends CombatSpinnerState>(
  result: ElementalSkillResult<TSpinner>,
  source: TSpinner,
  targets: readonly TSpinner[],
  isDamageable: (target: TSpinner) => boolean,
  settings: ElementalSkillSettings,
): void {
  result.rockRipplePositions.push(source.group.position.clone());
  for (const target of targets) {
    if (!isDamageable(target) || !isInsideAura(source, target, settings.auraRadius)) {
      continue;
    }
    const direction = target.group.position.clone().sub(source.group.position);
    direction.y = 0;
    result.damageCommands.push({ source, target, amount: settings.earthDamage, direction });
    result.launchCommands.push({ target, verticalVelocity: settings.earthLaunchVelocity });
  }
}

function getFrostStatus<TSpinner extends CombatSpinnerState>(
  state: ElementalSkillState<TSpinner>,
  target: TSpinner,
): FrostStatus {
  let status = state.frostStatusByTarget.get(target);
  if (!status) {
    status = { exposure: 0, freezeTimeRemaining: 0, visuallyFrozen: false };
    state.frostStatusByTarget.set(target, status);
  }
  return status;
}

function clearFrostStatus<TSpinner extends CombatSpinnerState>(
  target: TSpinner,
  status: FrostStatus,
  result: ElementalSkillResult<TSpinner>,
): void {
  status.exposure = 0;
  status.freezeTimeRemaining = 0;
  target.incomingDamageMultiplier = 1;
  target.elementalMoveSpeedMultiplier = 1;
  target.elementalMovementLocked = false;
  if (status.visuallyFrozen) {
    status.visuallyFrozen = false;
    result.freezeCommands.push({ target, frozen: false });
  }
}

function setFrozen(target: CombatSpinnerState, settings: ElementalSkillSettings): void {
  target.incomingDamageMultiplier = settings.frostFragileDamageMultiplier;
  target.elementalMoveSpeedMultiplier = 0;
  target.elementalMovementLocked = true;
}

function isInsideAura(source: CombatSpinnerState, target: CombatSpinnerState, radius: number): boolean {
  const x = source.group.position.x - target.group.position.x;
  const z = source.group.position.z - target.group.position.z;
  return x * x + z * z <= radius * radius;
}

function createEmptyResult<TSpinner extends CombatSpinnerState>(): ElementalSkillResult<TSpinner> {
  return { damageCommands: [], launchCommands: [], freezeCommands: [], rockRipplePositions: [] };
}
