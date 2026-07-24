import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import {
  advanceSpinnerDestructions,
  collectSpinnerDeaths,
  isSpinnerAlive,
  isSpinnerDamageable,
  spinnerDestructionDuration,
  type SpinnerLifeParticipant,
} from "./spinnerLife";

type Participant = SpinnerLifeParticipant & { id: string };

function createParticipant(id: string, maxRPM: number): Participant {
  return {
    id,
    lifeState: "alive",
    destructionTimer: 0,
    maxRPM,
  };
}

describe("spinner life", () => {
  it("starts destruction below one RPM exactly once", () => {
    const attacker = createParticipant("attacker", 100);
    const victim = createParticipant("victim", 0.99);
    const event = {
      source: attacker,
      target: victim,
      amount: 10,
      position: new THREE.Vector3(1, 0, 2),
      direction: new THREE.Vector3(1, 0, 0),
    };

    expect(collectSpinnerDeaths([attacker, victim], [event])).toHaveLength(1);
    expect(victim.lifeState).toBe("destroying");
    expect(victim.destructionTimer).toBe(spinnerDestructionDuration);
    expect(collectSpinnerDeaths([attacker, victim], [event])).toHaveLength(0);
    expect(isSpinnerAlive(victim)).toBe(false);
    expect(isSpinnerDamageable(victim)).toBe(false);
  });

  it("keeps a spinner alive at exactly one RPM", () => {
    const participant = createParticipant("participant", 1);
    expect(collectSpinnerDeaths([participant], [])).toHaveLength(0);
    expect(participant.lifeState).toBe("alive");
  });

  it("completes destruction after 1.8 seconds without depending on rendering", () => {
    const participant = createParticipant("participant", 0);
    collectSpinnerDeaths([participant], []);
    const onComplete = vi.fn((spinner: Participant) => {
      spinner.lifeState = "eliminated";
    });

    advanceSpinnerDestructions([participant], 1.79, onComplete);
    expect(onComplete).not.toHaveBeenCalled();
    advanceSpinnerDestructions([participant], 0.01, onComplete);
    expect(onComplete).toHaveBeenCalledOnce();
    expect(participant.lifeState).toBe("eliminated");
    expect(isSpinnerAlive(participant)).toBe(false);
    expect(isSpinnerDamageable(participant)).toBe(false);
    advanceSpinnerDestructions([participant], 1, onComplete);
    expect(onComplete).toHaveBeenCalledOnce();
  });
});
