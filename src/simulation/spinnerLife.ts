import * as THREE from "three";

export const spinnerDeathRpmThreshold = 1;
export const spinnerDestructionDuration = 1.8;

export type SpinnerLifeState = "alive" | "destroying" | "eliminated";

export type SpinnerLifeParticipant = {
  lifeState: SpinnerLifeState;
  destructionTimer: number;
  maxRPM: number;
};

export type SpinnerDeathDamageEvent<TParticipant extends SpinnerLifeParticipant> = {
  source: TParticipant;
  target: TParticipant;
  amount: number;
  position: THREE.Vector3;
  direction: THREE.Vector3;
};

export type SpinnerDeath<TParticipant extends SpinnerLifeParticipant> = {
  victim: TParticipant;
  killer: TParticipant | null;
  impact: SpinnerDeathDamageEvent<TParticipant> | null;
};

export function isSpinnerAlive(participant: SpinnerLifeParticipant): boolean {
  return participant.lifeState === "alive";
}

export function isSpinnerDamageable(participant: SpinnerLifeParticipant): boolean {
  return isSpinnerAlive(participant);
}

export function collectSpinnerDeaths<TParticipant extends SpinnerLifeParticipant>(
  participants: TParticipant[],
  damageEvents: SpinnerDeathDamageEvent<TParticipant>[],
): SpinnerDeath<TParticipant>[] {
  const impactByVictim = getStrongestImpacts(damageEvents);
  const deaths: SpinnerDeath<TParticipant>[] = [];

  for (const victim of participants) {
    if (!isSpinnerAlive(victim) || victim.maxRPM >= spinnerDeathRpmThreshold) continue;

    const impact = impactByVictim.get(victim) ?? null;
    victim.lifeState = "destroying";
    victim.destructionTimer = spinnerDestructionDuration;
    deaths.push({
      victim,
      killer: impact && impact.source !== victim ? impact.source : null,
      impact,
    });
  }

  return deaths;
}

export function advanceSpinnerDestructions<TParticipant extends SpinnerLifeParticipant>(
  participants: TParticipant[],
  deltaTime: number,
  onComplete: (participant: TParticipant) => void,
): void {
  for (const participant of participants) {
    if (participant.lifeState !== "destroying" || participant.destructionTimer <= 0) continue;
    participant.destructionTimer = Math.max(0, participant.destructionTimer - deltaTime);
    if (participant.destructionTimer <= 0.000001) {
      participant.destructionTimer = 0;
      onComplete(participant);
    }
  }
}

function getStrongestImpacts<TParticipant extends SpinnerLifeParticipant>(
  damageEvents: SpinnerDeathDamageEvent<TParticipant>[],
): Map<TParticipant, SpinnerDeathDamageEvent<TParticipant>> {
  const impacts = new Map<TParticipant, SpinnerDeathDamageEvent<TParticipant>>();
  for (const event of damageEvents) {
    if (event.amount <= 0) continue;
    const current = impacts.get(event.target);
    if (!current || event.amount > current.amount) impacts.set(event.target, event);
  }
  return impacts;
}
