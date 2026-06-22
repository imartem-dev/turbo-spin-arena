export type MoveSpeedState = {
  currentRPM: number;
  maxRPM: number;
  baseMoveSpeed: number;
  bonusSpeedMultiplier?: number;
  critSpeedEase?: number;
};

export type RpmRecoveryState = {
  currentRPM: number;
  maxRPM: number;
  distanceMovedThisTick: number;
};

export type SpeedLimitRampState = {
  speedLimitRatio: number;
};

export type CritSpeedState = MoveSpeedState & {
  velocity: { length(): number };
};

export const minMoveSpeedRatio = 0.4;
export const rpmMoveSpeedCurve = 3;
export const criticalSpeedRatio = 0.95;
export const rpmRecoveryResponsePerMeter = 1 / 15;
export const speedLimitMinRatio = 0.75;
export const speedLimitRampResponse = 1;

export function getRpmMoveSpeedRatio(currentRPM: number, maxRPM: number): number {
  const rpmRatio = maxRPM > 0 ? Math.min(Math.max(currentRPM / maxRPM, 0), 1) : 0;
  const curvedRatio = 1 - (1 - rpmRatio) ** rpmMoveSpeedCurve;
  return minMoveSpeedRatio + (1 - minMoveSpeedRatio) * curvedRatio;
}

export function getCurrentMoveSpeed(spinner: MoveSpeedState): number {
  return spinner.baseMoveSpeed * (spinner.bonusSpeedMultiplier ?? 1) * getRpmMoveSpeedRatio(spinner.currentRPM, spinner.maxRPM);
}

export function getCriticalSpeed(spinner: MoveSpeedState): number {
  return getCurrentMoveSpeed(spinner) * criticalSpeedRatio * (1 - (spinner.critSpeedEase ?? 0));
}

export function recoverRPMFromMovement(spinner: RpmRecoveryState): void {
  const recoverableRPM = spinner.maxRPM - spinner.currentRPM;
  if (recoverableRPM <= 0) {
    spinner.currentRPM = Math.min(spinner.currentRPM, spinner.maxRPM);
    return;
  }

  const recoveryRatio = 1 - Math.exp(-spinner.distanceMovedThisTick * rpmRecoveryResponsePerMeter);
  spinner.currentRPM = Math.min(spinner.maxRPM, spinner.currentRPM + recoverableRPM * recoveryRatio);
}

export function updateSpeedLimitRatio(spinner: SpeedLimitRampState, deltaTime: number): void {
  const recoveryRatio = 1 - Math.exp(-deltaTime * speedLimitRampResponse);
  spinner.speedLimitRatio = Math.min(1, spinner.speedLimitRatio + (1 - spinner.speedLimitRatio) * recoveryRatio);
}

export function resetSpeedLimitRatio(spinner: SpeedLimitRampState): void {
  spinner.speedLimitRatio = speedLimitMinRatio;
}

export function isCritSpeedReady(spinner: CritSpeedState): boolean {
  return spinner.velocity.length() >= getCriticalSpeed(spinner);
}
