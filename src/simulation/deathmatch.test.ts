import { describe, expect, it } from "vitest";
import {
  countAliveDeathmatchParticipants,
  preserveFinalDeathmatchSurvivor,
  recordDeathmatchEliminations,
  type DeathmatchParticipantState,
} from "./deathmatch";

type Participant = DeathmatchParticipantState;

function createParticipant(participantId: string, maxRPM = 6000): Participant {
  return {
    participantId,
    lifeState: "alive",
    destructionTimer: 0,
    currentRPM: maxRPM,
    maxRPM,
    kills: 0,
  };
}

describe("deathmatch elimination", () => {
  it("counts only participants that can still fight", () => {
    const alive = createParticipant("alive");
    const destroying = createParticipant("destroying");
    const eliminated = createParticipant("eliminated");
    destroying.lifeState = "destroying";
    eliminated.lifeState = "eliminated";

    expect(countAliveDeathmatchParticipants([alive, destroying, eliminated])).toBe(1);
  });

  it("does not count same-step eliminations as deaths before the player", () => {
    const earlier = createParticipant("earlier");
    const player = createParticipant("player", 0);
    const sameStep = createParticipant("same-step", 0);
    earlier.lifeState = "eliminated";
    const participants = [earlier, player, sameStep];

    const defeatedBeforePlayer = participants.length - countAliveDeathmatchParticipants(participants);
    player.lifeState = "destroying";
    sameStep.lifeState = "destroying";

    expect(defeatedBeforePlayer).toBe(1);
  });

  it("credits the killer without obsolete score fields", () => {
    const killer = createParticipant("killer");
    const victim = createParticipant("victim", 0);

    recordDeathmatchEliminations([{ victim, killer, impact: null }]);

    expect(killer.kills).toBe(1);
  });

  it("preserves the lethal finalist with the greatest remaining max RPM", () => {
    const weaker = createParticipant("bot-a", 0.2);
    const stronger = createParticipant("bot-b", 0.8);

    expect(preserveFinalDeathmatchSurvivor([weaker, stronger])).toBe(stronger);
    expect(stronger.maxRPM).toBe(1);
    expect(stronger.currentRPM).toBe(1);
  });

  it("breaks an exact finalist tie by stable participant id", () => {
    const later = createParticipant("bot-b", 0);
    const earlier = createParticipant("bot-a", 0);

    expect(preserveFinalDeathmatchSurvivor([later, earlier])).toBe(earlier);
  });

  it("does not intervene while a non-lethal participant remains", () => {
    const lethal = createParticipant("lethal", 0);
    const alive = createParticipant("alive", 100);

    expect(preserveFinalDeathmatchSurvivor([lethal, alive])).toBeNull();
    expect(lethal.maxRPM).toBe(0);
  });
});
