export type DashSettings = {
  duration: number;
  cooldown: number;
  speedMultiplier: number;
};

export type DashDirection = {
  x: number;
  z: number;
};

export type DashState = {
  settings: DashSettings;
  activeTimeRemaining: number;
  cooldownRemaining: number;
  direction: DashDirection;
};

const movementCooldownEpsilon = 0.001;

export function createDashState(settings: DashSettings): DashState {
  return {
    settings,
    activeTimeRemaining: 0,
    cooldownRemaining: 0,
    direction: { x: 1, z: 0 },
  };
}

export function tryStartDash(state: DashState, direction: DashDirection): boolean {
  if (state.activeTimeRemaining > 0 || state.cooldownRemaining > 0) {
    return false;
  }

  const length = Math.hypot(direction.x, direction.z);
  if (length <= 0.000001) {
    return false;
  }

  state.direction.x = direction.x / length;
  state.direction.z = direction.z / length;
  state.activeTimeRemaining = state.settings.duration;
  state.cooldownRemaining = state.settings.cooldown;
  return true;
}

export function updateDashState(state: DashState, deltaTime: number, movedDistance: number): void {
  state.activeTimeRemaining = Math.max(0, state.activeTimeRemaining - deltaTime);

  if (movedDistance > movementCooldownEpsilon) {
    state.cooldownRemaining = Math.max(0, state.cooldownRemaining - deltaTime);
  }
}

export function getDashSpeedMultiplier(state: DashState): number {
  return state.activeTimeRemaining > 0 ? state.settings.speedMultiplier : 1;
}
