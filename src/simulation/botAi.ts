import * as THREE from "three";

export type BotAiRole = "seek" | "attack" | "evade" | "recover";

export type BotAiSettings = {
  globalAttackLimit: number;
  maxAttackersPerTarget: number;
  windupDistance: number;
  separationStrength: number;
  predictionTurnFactor: number;
  attackCooldown: number;
  crowdPenalty: number;
};

export type BotAiSpinner = {
  name: string;
  group: THREE.Group;
  targetPosition: THREE.Vector3;
  velocity: THREE.Vector3;
  radius: number;
  currentRPM: number;
  maxRPM: number;
};

export type BotAiCommand = {
  role: BotAiRole;
  target: THREE.Vector3;
  visualTarget: THREE.Vector3;
  targetSpinner: BotAiSpinner | null;
};

type BotAgentState = {
  role: BotAiRole;
  targetSpinner: BotAiSpinner | null;
  targetSwitchCooldown: number;
  attackCooldown: number;
  attackElapsed: number;
  commitRemaining: number;
  orbitSign: number;
  attackBlocked: boolean;
};

type AttackLoad = {
  global: number;
  perTarget: Map<BotAiSpinner, number>;
};

export type BotAiDirector = {
  update(context: {
    bots: BotAiSpinner[];
    targets: BotAiSpinner[];
    deltaTime: number;
    arenaRadius: number;
    settings: BotAiSettings;
  }): Map<BotAiSpinner, BotAiCommand>;
  forget(bot: BotAiSpinner): void;
};

const targetSwitchCooldown = 0.8;
const targetSwitchHysteresis = 1.2;
const attackCommitDuration = 0.24;
const maxAttackDuration = 0.95;
const evadeThreatDistance = 2.4;
const evadeThreatDot = 0.72;
export const botAiSeparationRadius = 1.65;
const minAttackDistance = 2.0;
const maxPredictionTime = 0.45;
const maxAttackStartDistancePadding = 1.3;
const edgeAwareStartRatio = 0.72;
const edgeAwareSafeTargetRatio = 0.78;

export function createBotAiDirector(): BotAiDirector {
  const states = new Map<BotAiSpinner, BotAgentState>();
  const commands = new Map<BotAiSpinner, BotAiCommand>();

  const getState = (bot: BotAiSpinner): BotAgentState => {
    let state = states.get(bot);
    if (!state) {
      state = {
        role: "seek",
        targetSpinner: null,
        targetSwitchCooldown: 0,
        attackCooldown: 0,
        attackElapsed: 0,
        commitRemaining: 0,
        orbitSign: Math.random() < 0.5 ? -1 : 1,
        attackBlocked: false,
      };
      states.set(bot, state);
    }
    return state;
  };

  return {
    update({ bots, targets, deltaTime, arenaRadius, settings }) {
      commands.clear();
      const liveBots = new Set(bots);
      for (const bot of states.keys()) {
        if (!liveBots.has(bot)) {
          states.delete(bot);
        }
      }

      const attackLoad: AttackLoad = { global: 0, perTarget: new Map() };
      for (const bot of bots) {
        const state = getState(bot);
        if (state.role === "attack" && state.targetSpinner) {
          addAttackLoad(attackLoad, state.targetSpinner);
        }
      }

      for (const bot of bots) {
        const state = getState(bot);
        tickStateTimers(state, deltaTime);
        updateTarget(bot, state, targets, settings);
        updateRole(bot, state, bots, states, attackLoad, settings, deltaTime);

        const command = buildCommand(bot, state, bots, arenaRadius, settings);
        commands.set(bot, command);
      }

      return commands;
    },

    forget(bot) {
      states.delete(bot);
      commands.delete(bot);
    },
  };
}

function tickStateTimers(state: BotAgentState, deltaTime: number): void {
  state.targetSwitchCooldown = Math.max(0, state.targetSwitchCooldown - deltaTime);
  state.attackCooldown = Math.max(0, state.attackCooldown - deltaTime);
  state.commitRemaining = Math.max(0, state.commitRemaining - deltaTime);
}

function updateTarget(
  bot: BotAiSpinner,
  state: BotAgentState,
  targets: BotAiSpinner[],
  settings: BotAiSettings,
): void {
  const candidates = targets.filter((target) => target !== bot);
  if (candidates.length === 0) {
    state.targetSpinner = null;
    return;
  }

  const currentTarget = state.targetSpinner && candidates.includes(state.targetSpinner) ? state.targetSpinner : null;
  const currentScore = currentTarget ? scoreTarget(bot, currentTarget, targets, settings) : -Infinity;
  let bestTarget = currentTarget ?? candidates[0];
  let bestScore = currentTarget ? currentScore : -Infinity;

  for (const target of candidates) {
    const score = scoreTarget(bot, target, targets, settings);
    if (score > bestScore) {
      bestTarget = target;
      bestScore = score;
    }
  }

  if (!currentTarget || (state.targetSwitchCooldown <= 0 && bestScore > currentScore + targetSwitchHysteresis)) {
    state.targetSpinner = bestTarget;
    state.targetSwitchCooldown = targetSwitchCooldown;
  }
}

function scoreTarget(
  bot: BotAiSpinner,
  target: BotAiSpinner,
  allTargets: BotAiSpinner[],
  settings: BotAiSettings,
): number {
  const distance = bot.group.position.distanceTo(target.group.position);
  const rpmRatio = target.maxRPM > 0 ? THREE.MathUtils.clamp(target.currentRPM / target.maxRPM, 0, 1) : 0;
  const nearbyCount = countNearbySpinners(target, allTargets, 2.6);

  return 18 - distance * 1.15 + (1 - rpmRatio) * 4 - nearbyCount * settings.crowdPenalty;
}

function updateRole(
  bot: BotAiSpinner,
  state: BotAgentState,
  bots: BotAiSpinner[],
  states: Map<BotAiSpinner, BotAgentState>,
  attackLoad: AttackLoad,
  settings: BotAiSettings,
  deltaTime: number,
): void {
  state.attackBlocked = false;

  if (!state.targetSpinner) {
    state.role = "seek";
    return;
  }

  if (state.role === "attack") {
    state.attackElapsed += deltaTime;
    const shouldStop = shouldAbortAttack(bot, state);
    if (state.commitRemaining <= 0 && shouldStop) {
      removeAttackLoad(attackLoad, state.targetSpinner);
      state.role = "recover";
      state.attackCooldown = settings.attackCooldown;
      state.attackElapsed = 0;
    }
    return;
  }

  if (state.attackCooldown > 0) {
    state.role = hasIncomingThreat(bot, bots, states) ? "evade" : "recover";
    return;
  }

  if (hasIncomingThreat(bot, bots, states)) {
    state.role = "evade";
    return;
  }

  const targetDistance = bot.group.position.distanceTo(state.targetSpinner.group.position);
  const hasAttackToken = canStartAttack(state.targetSpinner, attackLoad, settings);
  const isInAttackStartRange =
    targetDistance >= minAttackDistance && targetDistance <= settings.windupDistance + maxAttackStartDistancePadding;

  if (isInAttackStartRange && hasAttackToken) {
    state.role = "attack";
    state.attackElapsed = 0;
    state.commitRemaining = attackCommitDuration;
    addAttackLoad(attackLoad, state.targetSpinner);
    return;
  }

  state.attackBlocked = !hasAttackToken;
  state.role = "seek";
}

function shouldAbortAttack(bot: BotAiSpinner, state: BotAgentState): boolean {
  const target = state.targetSpinner;
  if (!target) {
    return true;
  }

  const toTarget = new THREE.Vector3().subVectors(target.group.position, bot.group.position);
  toTarget.y = 0;
  const distance = toTarget.length();
  if (distance <= bot.radius + target.radius + 0.2 || state.attackElapsed >= maxAttackDuration) {
    return true;
  }

  if (distance > 0.001 && bot.velocity.lengthSq() > 0.001) {
    const attackAlignment = bot.velocity.clone().normalize().dot(toTarget.divideScalar(distance));
    return attackAlignment < 0.2;
  }

  return false;
}

function buildCommand(
  bot: BotAiSpinner,
  state: BotAgentState,
  bots: BotAiSpinner[],
  arenaRadius: number,
  settings: BotAiSettings,
): BotAiCommand {
  if (!state.targetSpinner) {
    const fallback = clampToArena(bot.group.position.clone(), arenaRadius - bot.radius);
    return { role: "seek", target: fallback, visualTarget: fallback.clone(), targetSpinner: null };
  }

  const predictedTarget = predictTargetPosition(bot, state.targetSpinner, settings);
  let target = predictedTarget.clone();

  if (state.role === "seek") {
    target = state.attackBlocked
      ? getHoldPosition(bot, state.targetSpinner, predictedTarget, settings.windupDistance + 2.8, state.orbitSign, arenaRadius)
      : getWindupPosition(bot, state.targetSpinner, predictedTarget, settings.windupDistance, arenaRadius);
  } else if (state.role === "recover") {
    target = getHoldPosition(bot, state.targetSpinner, predictedTarget, settings.windupDistance + 3.2, state.orbitSign, arenaRadius);
  } else if (state.role === "evade") {
    target = getEvadePosition(bot, bots, predictedTarget);
  }

  target.add(getSeparationOffset(bot, bots, settings.separationStrength));
  target = clampToArena(target, arenaRadius - bot.radius);

  return {
    role: state.role,
    target,
    visualTarget: predictedTarget,
    targetSpinner: state.targetSpinner,
  };
}

function predictTargetPosition(
  bot: BotAiSpinner,
  target: BotAiSpinner,
  settings: BotAiSettings,
): THREE.Vector3 {
  const distance = bot.group.position.distanceTo(target.group.position);
  const predictionTime = THREE.MathUtils.clamp(distance * settings.predictionTurnFactor, 1 / 30, maxPredictionTime);
  return target.group.position.clone().addScaledVector(target.velocity, predictionTime);
}

function getWindupPosition(
  bot: BotAiSpinner,
  target: BotAiSpinner,
  predictedTarget: THREE.Vector3,
  windupDistance: number,
  arenaRadius: number,
): THREE.Vector3 {
  const awayFromTarget = new THREE.Vector3().subVectors(bot.group.position, predictedTarget);
  awayFromTarget.y = 0;
  if (awayFromTarget.lengthSq() <= 0.0001) {
    awayFromTarget.subVectors(bot.group.position, target.targetPosition);
    awayFromTarget.y = 0;
  }
  if (awayFromTarget.lengthSq() <= 0.0001) {
    awayFromTarget.set(1, 0, 0);
  }

  const direction = awayFromTarget.normalize();
  const windupTarget = predictedTarget.clone().addScaledVector(direction, windupDistance);
  return steerSetupTargetAwayFromEdge(windupTarget, predictedTarget, direction, windupDistance, arenaRadius, 1);
}

function getEvadePosition(bot: BotAiSpinner, bots: BotAiSpinner[], fallbackTarget: THREE.Vector3): THREE.Vector3 {
  const evade = new THREE.Vector3();
  for (const other of bots) {
    if (other === bot) {
      continue;
    }
    const away = new THREE.Vector3().subVectors(bot.group.position, other.group.position);
    away.y = 0;
    const distance = away.length();
    if (distance <= 0.001 || distance > evadeThreatDistance) {
      continue;
    }
    evade.addScaledVector(away.normalize(), (evadeThreatDistance - distance) / evadeThreatDistance);
  }

  if (evade.lengthSq() <= 0.0001) {
    return fallbackTarget.clone();
  }

  return bot.group.position.clone().addScaledVector(evade.normalize(), 3.0);
}

function getHoldPosition(
  bot: BotAiSpinner,
  target: BotAiSpinner,
  predictedTarget: THREE.Vector3,
  holdDistance: number,
  sideSign: number,
  arenaRadius: number,
): THREE.Vector3 {
  const awayFromTarget = new THREE.Vector3().subVectors(bot.group.position, predictedTarget);
  awayFromTarget.y = 0;
  if (awayFromTarget.lengthSq() <= 0.0001) {
    awayFromTarget.subVectors(bot.group.position, target.targetPosition);
    awayFromTarget.y = 0;
  }
  if (awayFromTarget.lengthSq() <= 0.0001) {
    awayFromTarget.set(1, 0, 0);
  }

  const direction = awayFromTarget.normalize();
  const tangent = new THREE.Vector3(-direction.z, 0, direction.x);
  const holdTarget = predictedTarget
    .clone()
    .addScaledVector(direction, holdDistance)
    .addScaledVector(tangent, sideSign * 0.8);
  return steerSetupTargetAwayFromEdge(holdTarget, predictedTarget, direction, holdDistance, arenaRadius, sideSign);
}

function steerSetupTargetAwayFromEdge(
  setupTarget: THREE.Vector3,
  predictedTarget: THREE.Vector3,
  preferredDirection: THREE.Vector3,
  setupDistance: number,
  arenaRadius: number,
  sideSign: number,
): THREE.Vector3 {
  const setupDistanceFromCenter = Math.hypot(setupTarget.x, setupTarget.z);
  if (setupDistanceFromCenter <= arenaRadius * edgeAwareStartRatio) {
    return setupTarget;
  }

  const inward = new THREE.Vector3(-predictedTarget.x, 0, -predictedTarget.z);
  if (inward.lengthSq() <= 0.0001) {
    return clampToArena(setupTarget, arenaRadius * edgeAwareSafeTargetRatio);
  }
  inward.normalize();

  const tangent = new THREE.Vector3(-inward.z * sideSign, 0, inward.x * sideSign);
  const tangentialDirection = tangent.dot(preferredDirection) >= 0 ? tangent : tangent.multiplyScalar(-1);
  const edgeAwareDirection = inward.multiplyScalar(0.72).addScaledVector(tangentialDirection, 0.28).normalize();
  const edgeAwareTarget = predictedTarget.clone().addScaledVector(edgeAwareDirection, setupDistance);
  return clampToArena(edgeAwareTarget, arenaRadius * edgeAwareSafeTargetRatio);
}

function getSeparationOffset(bot: BotAiSpinner, bots: BotAiSpinner[], strength: number): THREE.Vector3 {
  const offset = new THREE.Vector3();
  for (const other of bots) {
    if (other === bot) {
      continue;
    }
    const away = new THREE.Vector3().subVectors(bot.group.position, other.group.position);
    away.y = 0;
    const distance = away.length();
    if (distance <= 0.001 || distance > botAiSeparationRadius) {
      continue;
    }

    offset.addScaledVector(away.normalize(), ((botAiSeparationRadius - distance) / botAiSeparationRadius) * strength);
  }
  return offset;
}

function hasIncomingThreat(
  bot: BotAiSpinner,
  bots: BotAiSpinner[],
  states: Map<BotAiSpinner, BotAgentState>,
): boolean {
  for (const other of bots) {
    if (other === bot || other.velocity.lengthSq() <= 0.01) {
      continue;
    }
    if (states.get(other)?.role !== "attack") {
      continue;
    }

    const toBot = new THREE.Vector3().subVectors(bot.group.position, other.group.position);
    toBot.y = 0;
    const distance = toBot.length();
    if (distance <= 0.001 || distance > evadeThreatDistance) {
      continue;
    }

    if (other.velocity.clone().normalize().dot(toBot.divideScalar(distance)) >= evadeThreatDot) {
      return true;
    }
  }

  return false;
}

function canStartAttack(target: BotAiSpinner, attackLoad: AttackLoad, settings: BotAiSettings): boolean {
  const perTargetCount = attackLoad.perTarget.get(target) ?? 0;
  return attackLoad.global < Math.round(settings.globalAttackLimit) && perTargetCount < Math.round(settings.maxAttackersPerTarget);
}

function addAttackLoad(attackLoad: AttackLoad, target: BotAiSpinner): void {
  attackLoad.global += 1;
  attackLoad.perTarget.set(target, (attackLoad.perTarget.get(target) ?? 0) + 1);
}

function removeAttackLoad(attackLoad: AttackLoad, target: BotAiSpinner): void {
  attackLoad.global = Math.max(0, attackLoad.global - 1);
  const nextTargetLoad = Math.max(0, (attackLoad.perTarget.get(target) ?? 0) - 1);
  if (nextTargetLoad === 0) {
    attackLoad.perTarget.delete(target);
  } else {
    attackLoad.perTarget.set(target, nextTargetLoad);
  }
}

function countNearbySpinners(target: BotAiSpinner, spinners: BotAiSpinner[], radius: number): number {
  let count = 0;
  for (const spinner of spinners) {
    if (spinner !== target && spinner.group.position.distanceTo(target.group.position) <= radius) {
      count += 1;
    }
  }
  return count;
}

function clampToArena(position: THREE.Vector3, maxRadius: number): THREE.Vector3 {
  const clamped = position.clone();
  clamped.y = 0;
  const distanceFromCenter = Math.hypot(clamped.x, clamped.z);
  if (distanceFromCenter > maxRadius) {
    clamped.multiplyScalar(maxRadius / distanceFromCenter);
  }
  return clamped;
}
