import { describe, expect, it } from "vitest";
import {
  advanceTimedRewardActiveTime,
  claimTimedReward,
  createDefaultTimedRewardState,
  formatTimedRewardDuration,
  getTimedRewardSlotViews,
  parseTimedRewardState,
  resetTimedRewardsForMoscowDay,
  timedRewardSlots,
} from "./timedRewards";

describe("timed reward sequence", () => {
  it("starts with the first reward ready and gates the second by active time", () => {
    const state = createDefaultTimedRewardState();
    const inventory = { parts: 0, ownedItems: [] as string[] };
    const now = 1_000_000;
    expect(getTimedRewardSlotViews(state, now)[0].status).toBe("ready");
    expect(claimTimedReward(state, inventory, 0, now)?.parts).toBe(100);
    expect(getTimedRewardSlotViews(state, now)[1]).toMatchObject({ status: "current", remainingMs: 600_000 });
    advanceTimedRewardActiveTime(state, 600_000);
    expect(getTimedRewardSlotViews(state, now)[1].status).toBe("ready");
  });

  it("never allows claiming a future slot out of order", () => {
    const state = createDefaultTimedRewardState();
    expect(claimTimedReward(state, { parts: 0, ownedItems: [] }, 1, 1_000_000)).toBeNull();
  });

  it("resets every chest together at 00:10 Moscow time", () => {
    const state = createDefaultTimedRewardState();
    const inventory = { parts: 0, ownedItems: [] as string[] };
    const baseNow = Date.UTC(2026, 0, 1, 21, 9, 59);
    resetTimedRewardsForMoscowDay(state, baseNow);
    for (let index = 0; index < timedRewardSlots.length; index += 1) {
      state.activeMsInCycle = timedRewardSlots[index].unlockActiveMs;
      expect(claimTimedReward(state, inventory, index, baseNow)).not.toBeNull();
    }
    expect(state.currentIndex).toBe(0);
    expect(getTimedRewardSlotViews(state, baseNow)[0].status).toBe("ready");
    expect(resetTimedRewardsForMoscowDay(state, baseNow + 999)).toBe(false);
    expect(resetTimedRewardsForMoscowDay(state, baseNow + 1_000)).toBe(true);
    expect(state.activeMsInCycle).toBe(0);
    expect(getTimedRewardSlotViews(state, baseNow + 1_000)[0].status).toBe("ready");
  });

  it("awards the 10-minute chest without cosmetics", () => {
    const state = createDefaultTimedRewardState();
    state.currentIndex = 1;
    state.activeMsInCycle = timedRewardSlots[1].unlockActiveMs;
    const inventory = { parts: 0, ownedItems: [] as string[] };
    const grant = claimTimedReward(state, inventory, 1, 1_000_000);
    expect(grant?.unlocked).toEqual([]);
    expect(grant?.parts).toBe(150);
    expect(inventory.parts).toBe(150);
  });

  it("sanitizes persisted state and formats timers", () => {
    expect(parseTimedRewardState({ currentIndex: 99, activeMsInCycle: -5, dayKey: 123 }))
      .toMatchObject({ currentIndex: 6, activeMsInCycle: 0, dayKey: 123 });
    expect(formatTimedRewardDuration(0)).toBe("00:00");
    expect(formatTimedRewardDuration(3_661_000)).toBe("01:01:01");
  });
});
