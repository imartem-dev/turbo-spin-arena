export type DeathmatchStatus = "alive" | "respawning";

export type DeathmatchSettings = {
  respawnDelay: number;
  invulnerabilityDuration: number;
};

export type DeathmatchParticipantState = {
  participantId: string;
  name: string;
  deathmatchStatus: DeathmatchStatus;
  respawnTimer: number;
  invulnerabilityTimer: number;
  kills: number;
  deaths: number;
  playerCriticalHits: number;
  maxRPM: number;
};

export type DeathmatchDamageEvent<TParticipant extends DeathmatchParticipantState> = {
  source: TParticipant;
  target: TParticipant;
  amount: number;
  critical: boolean;
};

export type DeathmatchDeath<TParticipant extends DeathmatchParticipantState> = {
  victim: TParticipant;
  killer: TParticipant | null;
};

export type DeathmatchLeaderboardRow<TParticipant extends DeathmatchParticipantState> = {
  participant: TParticipant;
  rank: number;
  rating: number;
};

type KillerCandidate<TParticipant extends DeathmatchParticipantState> = {
  source: TParticipant;
  amount: number;
};

export const defaultDeathmatchSettings: DeathmatchSettings = {
  respawnDelay: 3,
  invulnerabilityDuration: 3,
};

export function isDeathmatchAlive(participant: DeathmatchParticipantState): boolean {
  return participant.deathmatchStatus === "alive";
}

export function isDeathmatchDamageable(participant: DeathmatchParticipantState): boolean {
  return isDeathmatchAlive(participant) && participant.invulnerabilityTimer <= 0;
}

export function recordPlayerCriticalHits<TParticipant extends DeathmatchParticipantState>(
  damageEvents: DeathmatchDamageEvent<TParticipant>[],
  player: TParticipant,
): void {
  for (const event of damageEvents) {
    if (event.source === player && event.target !== player && event.critical) {
      player.playerCriticalHits += 1;
    }
  }
}

export function applyDeathmatchDeaths<TParticipant extends DeathmatchParticipantState>(
  participants: TParticipant[],
  damageEvents: DeathmatchDamageEvent<TParticipant>[],
  settings: DeathmatchSettings,
): DeathmatchDeath<TParticipant>[] {
  const killerByVictim = getKillerCandidates(damageEvents);
  const deaths: DeathmatchDeath<TParticipant>[] = [];

  for (const victim of participants) {
    if (!isDeathmatchAlive(victim) || victim.maxRPM > 0) {
      continue;
    }

    const killer = killerByVictim.get(victim)?.source ?? null;
    victim.deathmatchStatus = "respawning";
    victim.respawnTimer = settings.respawnDelay;
    victim.invulnerabilityTimer = 0;
    victim.deaths += 1;

    if (killer && killer !== victim) {
      killer.kills += 1;
    }

    deaths.push({ victim, killer });
  }

  return deaths;
}

export function updateDeathmatchTimers<TParticipant extends DeathmatchParticipantState>(
  participants: TParticipant[],
  deltaTime: number,
  settings: DeathmatchSettings,
): TParticipant[] {
  const respawned: TParticipant[] = [];

  for (const participant of participants) {
    if (participant.deathmatchStatus === "respawning") {
      participant.respawnTimer = Math.max(0, participant.respawnTimer - deltaTime);
      if (participant.respawnTimer <= 0) {
        participant.deathmatchStatus = "alive";
        participant.invulnerabilityTimer = settings.invulnerabilityDuration;
        respawned.push(participant);
      }
      continue;
    }

    participant.invulnerabilityTimer = Math.max(0, participant.invulnerabilityTimer - deltaTime);
  }

  return respawned;
}

export function getDeathmatchRating(participant: DeathmatchParticipantState): number {
  return participant.kills * 100 - participant.deaths * 25 + participant.playerCriticalHits * 20;
}

export function getDeathmatchLeaderboardRows<TParticipant extends DeathmatchParticipantState>(
  participants: TParticipant[],
): DeathmatchLeaderboardRow<TParticipant>[] {
  return participants
    .map((participant, index) => ({
      participant,
      rank: 0,
      rating: getDeathmatchRating(participant),
      order: index,
    }))
    .sort((a, b) => {
      if (b.participant.kills !== a.participant.kills) {
        return b.participant.kills - a.participant.kills;
      }
      if (b.rating !== a.rating) {
        return b.rating - a.rating;
      }
      if (a.participant.deaths !== b.participant.deaths) {
        return a.participant.deaths - b.participant.deaths;
      }
      return a.order - b.order;
    })
    .map(({ participant, rating }, index) => ({
      participant,
      rating,
      rank: index + 1,
    }));
}

function getKillerCandidates<TParticipant extends DeathmatchParticipantState>(
  damageEvents: DeathmatchDamageEvent<TParticipant>[],
): Map<TParticipant, KillerCandidate<TParticipant>> {
  const candidates = new Map<TParticipant, KillerCandidate<TParticipant>>();

  for (const event of damageEvents) {
    if (event.amount <= 0 || event.source === event.target) {
      continue;
    }

    const current = candidates.get(event.target);
    if (!current || event.amount > current.amount) {
      candidates.set(event.target, {
        source: event.source,
        amount: event.amount,
      });
    }
  }

  return candidates;
}
