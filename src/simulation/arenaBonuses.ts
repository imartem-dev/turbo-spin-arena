import * as THREE from "three";

export type ArenaBonusType = "speed" | "critSpeed" | "critDamage" | "damage" | "heal";
export type TimedArenaBonusType = Exclude<ArenaBonusType, "heal">;

export type ArenaBonusPointStatus = "empty" | "occupied" | "cooldown";

export type ArenaBonusSettings = {
  maxActiveBonuses: number;
  minSpawnDelay: number;
  maxSpawnDelay: number;
  bonusLife: number;
  pickupRadius: number;
  effectDuration: number;
  pointCooldown: number;
};

export type ArenaBonus = {
  id: number;
  type: ArenaBonusType;
  pointIndex: number;
  position: THREE.Vector3;
  lifeRemaining: number;
};

export type ArenaBonusPoint = {
  position: THREE.Vector3;
  status: ArenaBonusPointStatus;
  cooldownRemaining: number;
  bonus: ArenaBonus | null;
};

export type ArenaBonusState = {
  points: ArenaBonusPoint[];
  nextBonusId: number;
  spawnDelayRemaining: number;
  settings: ArenaBonusSettings;
};

export type ArenaBonusEffect = {
  type: TimedArenaBonusType;
  timeRemaining: number;
};

export type ArenaBonusTargetState = {
  bonusEffects: ArenaBonusEffect[];
  bonusSpeedMultiplier: number;
  critSpeedEase: number;
  critDamageMultiplier: number;
  damageMultiplier: number;
};

export type ArenaBonusCollector<TTarget extends ArenaBonusTargetState = ArenaBonusTargetState> = {
  target: TTarget;
  position: THREE.Vector3;
  radius: number;
};

export type ArenaBonusPickup<TTarget extends ArenaBonusTargetState = ArenaBonusTargetState> = {
  target: TTarget;
  bonus: ArenaBonus;
};

export const defaultArenaBonusSettings: ArenaBonusSettings = {
  maxActiveBonuses: 2,
  minSpawnDelay: 4,
  maxSpawnDelay: 8,
  bonusLife: 12,
  pickupRadius: 1.05,
  effectDuration: 8,
  pointCooldown: 4,
};

const bonusTypes: ArenaBonusType[] = ["speed", "critSpeed", "critDamage", "damage", "heal"];

export function createArenaBonusState(
  interestPoints: THREE.Vector3[],
  settings: ArenaBonusSettings = defaultArenaBonusSettings,
  random = Math.random,
): ArenaBonusState {
  return {
    points: interestPoints.map((position) => ({
      position: position.clone(),
      status: "empty",
      cooldownRemaining: 0,
      bonus: null,
    })),
    nextBonusId: 1,
    spawnDelayRemaining: getRandomSpawnDelay(settings, random),
    settings,
  };
}

export function updateArenaBonuses(state: ArenaBonusState, deltaTime: number, random = Math.random): void {
  for (const point of state.points) {
    if (point.status === "occupied" && point.bonus) {
      point.bonus.lifeRemaining -= deltaTime;
      if (point.bonus.lifeRemaining <= 0) {
        clearPointBonus(point, state.settings);
      }
      continue;
    }

    if (point.status === "cooldown") {
      point.cooldownRemaining = Math.max(0, point.cooldownRemaining - deltaTime);
      if (point.cooldownRemaining <= 0) {
        point.status = "empty";
      }
    }
  }

  if (getActiveBonusCount(state) >= state.settings.maxActiveBonuses) {
    return;
  }

  state.spawnDelayRemaining -= deltaTime;
  if (state.spawnDelayRemaining > 0) {
    return;
  }

  const emptyPoints = state.points.filter((point) => point.status === "empty");
  if (emptyPoints.length > 0) {
    const point = emptyPoints[Math.floor(random() * emptyPoints.length)];
    const pointIndex = state.points.indexOf(point);
    point.status = "occupied";
    point.bonus = {
      id: state.nextBonusId,
      type: bonusTypes[Math.floor(random() * bonusTypes.length)],
      pointIndex,
      position: point.position.clone(),
      lifeRemaining: state.settings.bonusLife,
    };
    state.nextBonusId += 1;
  }

  state.spawnDelayRemaining = getRandomSpawnDelay(state.settings, random);
}

export function collectArenaBonuses<TTarget extends ArenaBonusTargetState>(
  state: ArenaBonusState,
  collectors: ArenaBonusCollector<TTarget>[],
): ArenaBonusPickup<TTarget>[] {
  const pickups: ArenaBonusPickup<TTarget>[] = [];
  for (const point of state.points) {
    if (point.status !== "occupied" || !point.bonus) {
      continue;
    }

    const bonus = point.bonus;
    const collector = collectors.find((item) => {
      const pickupDistance = state.settings.pickupRadius + item.radius;
      return item.position.distanceToSquared(bonus.position) <= pickupDistance * pickupDistance;
    });

    if (!collector) {
      continue;
    }

    pickups.push({ target: collector.target, bonus });
    clearPointBonus(point, state.settings);
  }
  return pickups;
}

export function applyArenaBonusEffect(target: ArenaBonusTargetState, type: TimedArenaBonusType, duration: number): void {
  const existing = target.bonusEffects.find((effect) => effect.type === type);
  if (existing) {
    existing.timeRemaining = duration;
  } else {
    target.bonusEffects.push({ type, timeRemaining: duration });
  }
  recalculateArenaBonusTarget(target);
}

export function updateArenaBonusEffects(target: ArenaBonusTargetState, deltaTime: number): void {
  for (let i = target.bonusEffects.length - 1; i >= 0; i -= 1) {
    const effect = target.bonusEffects[i];
    effect.timeRemaining -= deltaTime;
    if (effect.timeRemaining <= 0) {
      target.bonusEffects.splice(i, 1);
    }
  }
  recalculateArenaBonusTarget(target);
}

export function getActiveArenaBonuses(state: ArenaBonusState): ArenaBonus[] {
  return state.points.flatMap((point) => point.bonus ? [point.bonus] : []);
}

function clearPointBonus(point: ArenaBonusPoint, settings: ArenaBonusSettings): void {
  point.bonus = null;
  point.status = "cooldown";
  point.cooldownRemaining = settings.pointCooldown;
}

function getActiveBonusCount(state: ArenaBonusState): number {
  return state.points.reduce((count, point) => count + (point.bonus ? 1 : 0), 0);
}

function getRandomSpawnDelay(settings: ArenaBonusSettings, random: () => number): number {
  return THREE.MathUtils.lerp(settings.minSpawnDelay, settings.maxSpawnDelay, random());
}

function recalculateArenaBonusTarget(target: ArenaBonusTargetState): void {
  target.bonusSpeedMultiplier = 1;
  target.critSpeedEase = 0;
  target.critDamageMultiplier = 1;
  target.damageMultiplier = 1;

  for (const effect of target.bonusEffects) {
    if (effect.type === "speed") {
      target.bonusSpeedMultiplier = 1.18;
    } else if (effect.type === "critSpeed") {
      target.critSpeedEase = 0.2;
    } else if (effect.type === "critDamage") {
      target.critDamageMultiplier = 1.2;
    } else if (effect.type === "damage") {
      target.damageMultiplier = 1.15;
    }
  }
}
