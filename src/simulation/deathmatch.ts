import type { SpinnerDeath, SpinnerLifeParticipant } from "./spinnerLife";
import { isSpinnerAlive, spinnerDeathRpmThreshold } from "./spinnerLife";

export type DeathmatchParticipantState = SpinnerLifeParticipant & {
  participantId: string;
  currentRPM: number;
  kills: number;
};

export function countAliveDeathmatchParticipants(
  participants: SpinnerLifeParticipant[],
): number {
  return participants.filter(isSpinnerAlive).length;
}

export function recordDeathmatchEliminations<TParticipant extends DeathmatchParticipantState>(
  deaths: SpinnerDeath<TParticipant>[],
): void {
  for (const death of deaths) {
    if (death.killer && death.killer !== death.victim) death.killer.kills += 1;
  }
}

export function preserveFinalDeathmatchSurvivor<
  TParticipant extends DeathmatchParticipantState,
>(participants: TParticipant[]): TParticipant | null {
  const alive = participants.filter(isSpinnerAlive);
  const lethal = alive.filter((participant) => participant.maxRPM < spinnerDeathRpmThreshold);
  if (alive.length === 0 || lethal.length !== alive.length) return null;

  const survivor = lethal.reduce((best, candidate) => {
    if (candidate.maxRPM !== best.maxRPM) {
      return candidate.maxRPM > best.maxRPM ? candidate : best;
    }
    return candidate.participantId < best.participantId ? candidate : best;
  });
  survivor.maxRPM = spinnerDeathRpmThreshold;
  survivor.currentRPM = spinnerDeathRpmThreshold;
  return survivor;
}
