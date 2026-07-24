import * as THREE from "three";
import { describe, expect, it } from "vitest";
import type { CombatSpinnerState } from "./combat";
import {
  activateElementalSkill,
  createElementalSkillState,
  defaultElementalSkillSettings,
  updateElementalSkills,
} from "./elementalSkills";

function createSpinner(name: string, x = 0): CombatSpinnerState {
  const group = new THREE.Group();
  group.position.x = x;
  return {
    name,
    group,
    velocity: new THREE.Vector3(),
    forwardDirection: new THREE.Vector3(1, 0, 0),
    radius: 0.5,
    pulseTimer: 0,
    currentRPM: 1000,
    maxRPM: 1000,
    absoluteMaxRPM: 1000,
    baseMoveSpeed: 1,
  };
}

describe("elemental skills", () => {
  it("freezes a target immediately when it enters the frost aura", () => {
    const source = createSpinner("player");
    const target = createSpinner("enemy", 9);
    const state = createElementalSkillState<CombatSpinnerState>();
    activateElementalSkill(state, source, [target], "ice", () => true);

    target.group.position.x = 8;
    target.velocity.set(4, 0, -2);
    const result = updateElementalSkills(state, source, [target], true, 0.1, () => true);

    expect(result.freezeCommands).toEqual([{ target, frozen: true }]);
    expect(target.elementalMovementLocked).toBe(true);
    expect(target.elementalMoveSpeedMultiplier).toBe(0);
    expect(target.incomingDamageMultiplier).toBe(defaultElementalSkillSettings.frostFragileDamageMultiplier);
    expect(target.velocity.lengthSq()).toBe(0);
  });

  it("keeps a target frozen inside the aura and thaws it three seconds after exit", () => {
    const source = createSpinner("player");
    const target = createSpinner("enemy", 4);
    const state = createElementalSkillState<CombatSpinnerState>();
    activateElementalSkill(state, source, [target], "ice", () => true);

    expect(updateElementalSkills(state, source, [target], true, 5, () => true).freezeCommands).toEqual([]);
    expect(target.elementalMovementLocked).toBe(true);

    target.group.position.x = 9;
    expect(updateElementalSkills(state, source, [target], true, 2.99, () => true).freezeCommands).toEqual([]);
    expect(target.elementalMovementLocked).toBe(true);

    const thawResult = updateElementalSkills(state, source, [target], true, 0.01, () => true);
    expect(thawResult.freezeCommands).toEqual([{ target, frozen: false }]);
    expect(target.elementalMovementLocked).toBe(false);
    expect(target.elementalMoveSpeedMultiplier).toBe(1);
    expect(target.incomingDamageMultiplier).toBe(1);
  });

  it("clears frost immediately when a frozen target is no longer damageable", () => {
    const source = createSpinner("player");
    const target = createSpinner("enemy", 4);
    const state = createElementalSkillState<CombatSpinnerState>();
    activateElementalSkill(state, source, [target], "ice", () => true);

    const result = updateElementalSkills(state, source, [target], true, 0.1, () => false);

    expect(result.freezeCommands).toEqual([{ target, frozen: false }]);
    expect(target.elementalMovementLocked).toBe(false);
    expect(target.elementalMoveSpeedMultiplier).toBe(1);
    expect(target.incomingDamageMultiplier).toBe(1);
  });

  it("uses radius eight for frost and earth while excluding targets beyond it", () => {
    const source = createSpinner("player");
    const boundaryTarget = createSpinner("boundary", 8);
    const outsideTarget = createSpinner("outside", 8.01);
    const frostState = createElementalSkillState<CombatSpinnerState>();

    const frostResult = activateElementalSkill(
      frostState,
      source,
      [boundaryTarget, outsideTarget],
      "ice",
      () => true,
    );
    expect(frostResult.freezeCommands.map((command) => command.target)).toEqual([boundaryTarget]);

    const earthResult = activateElementalSkill(
      createElementalSkillState<CombatSpinnerState>(),
      source,
      [boundaryTarget, outsideTarget],
      "earth",
      () => true,
    );
    expect(earthResult.damageCommands.map((command) => command.target)).toEqual([boundaryTarget]);
    expect(earthResult.launchCommands.map((command) => command.target)).toEqual([boundaryTarget]);
    expect(earthResult.launchCommands[0].verticalVelocity).toBe(14);
  });

  it("uses the stronger launch velocity for both earth pulses", () => {
    const source = createSpinner("player");
    const target = createSpinner("enemy", 6);
    const state = createElementalSkillState<CombatSpinnerState>();

    const firstPulse = activateElementalSkill(state, source, [target], "earth", () => true);
    const secondPulse = updateElementalSkills(
      state,
      source,
      [target],
      true,
      defaultElementalSkillSettings.earthSecondPulseDelay,
      () => true,
    );

    expect(firstPulse.launchCommands).toEqual([{ target, verticalVelocity: 14 }]);
    expect(secondPulse.launchCommands).toEqual([{ target, verticalVelocity: 14 }]);
  });
});
