export type UltimateChargeSettings = {
  maxCharge: number;
  chargePerDamageDealt: number;
  chargePerDamageTaken: number;
  passiveChargePerSecond: number;
  activeDuration: number;
  speedMultiplier: number;
};

export type UltimateChargeState = {
  settings: UltimateChargeSettings;
  charge: number;
  activeTimeRemaining: number;
};

export function createUltimateChargeState(settings: UltimateChargeSettings): UltimateChargeState {
  return {
    settings,
    charge: 0,
    activeTimeRemaining: 0,
  };
}

export function addUltimateCharge(state: UltimateChargeState, amount: number): void {
  if (amount <= 0 || isUltimateActive(state)) {
    return;
  }

  state.charge = Math.min(state.settings.maxCharge, state.charge + amount);
}

export function updateUltimatePassiveCharge(state: UltimateChargeState, deltaTime: number): void {
  if (isUltimateActive(state)) {
    return;
  }

  addUltimateCharge(state, state.settings.passiveChargePerSecond * deltaTime);
}

export function getUltimateChargeRatio(state: UltimateChargeState): number {
  return state.settings.maxCharge > 0 ? Math.min(Math.max(state.charge / state.settings.maxCharge, 0), 1) : 0;
}

export function tryActivateUltimate(state: UltimateChargeState): boolean {
  if (!isUltimateReady(state) || isUltimateActive(state)) {
    return false;
  }

  state.charge = 0;
  state.activeTimeRemaining = state.settings.activeDuration;
  return true;
}

export function updateUltimateActive(state: UltimateChargeState, deltaTime: number): void {
  state.activeTimeRemaining = Math.max(0, state.activeTimeRemaining - deltaTime);
}

export function isUltimateReady(state: UltimateChargeState): boolean {
  return state.charge >= state.settings.maxCharge;
}

export function isUltimateActive(state: UltimateChargeState): boolean {
  return state.activeTimeRemaining > 0;
}
