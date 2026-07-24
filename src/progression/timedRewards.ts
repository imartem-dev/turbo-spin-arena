import { colorCatalog } from "./catalog";

export type TimedRewardChest = "common" | "gold" | "legendary";
export type TimedRewardCosmeticKind = "color";
export type TimedRewardCosmetic = { kind: TimedRewardCosmeticKind; itemId: string; compensationParts: number };
export type TimedRewardSlot = { id: string; unlockActiveMs: number; chest: TimedRewardChest; parts: number; colorChance: number };
export type TimedRewardState = { cycle: number; dayKey: number; adClaimedDayKey: number; currentIndex: number; activeMsInCycle: number };
export type TimedRewardInventory = { parts: number; ownedItems: string[] };
export type TimedRewardGrant = { slotIndex: number; chest: TimedRewardChest; parts: number; unlocked: TimedRewardCosmetic[]; compensated: TimedRewardCosmetic[] };
export type TimedRewardSlotStatus = "claimed" | "ready" | "current" | "locked";
export type TimedRewardSlotView = { slot: TimedRewardSlot; index: number; remainingMs: number; status: TimedRewardSlotStatus };

const minuteMs = 60_000;
const moscowUtcOffsetMs = 3 * 60 * minuteMs;
const dailyResetOffsetMs = 10 * minuteMs;

export const timedRewardSlots: readonly TimedRewardSlot[] = [
  { id: "reward_1", unlockActiveMs: 0, chest: "common", parts: 100, colorChance: 0 },
  { id: "reward_2", unlockActiveMs: 10 * minuteMs, chest: "common", parts: 150, colorChance: 0 },
  { id: "reward_3", unlockActiveMs: 20 * minuteMs, chest: "common", parts: 180, colorChance: 0.1 },
  { id: "reward_4", unlockActiveMs: 30 * minuteMs, chest: "common", parts: 280, colorChance: 0.2 },
  { id: "reward_5", unlockActiveMs: 40 * minuteMs, chest: "gold", parts: 400, colorChance: 0.35 },
  { id: "reward_6", unlockActiveMs: 50 * minuteMs, chest: "gold", parts: 550, colorChance: 0.5 },
  { id: "reward_7", unlockActiveMs: 60 * minuteMs, chest: "legendary", parts: 750, colorChance: 1 },
] as const;

export function createDefaultTimedRewardState(): TimedRewardState {
  return { cycle: 0, dayKey: 0, adClaimedDayKey: 0, currentIndex: 0, activeMsInCycle: 0 };
}

export function parseTimedRewardState(value: unknown): TimedRewardState {
  const defaults = createDefaultTimedRewardState();
  if (!value || typeof value !== "object") return defaults;
  const stored = value as Partial<TimedRewardState>;
  return {
    cycle: safeInteger(stored.cycle), dayKey: safeInteger(stored.dayKey), adClaimedDayKey: safeInteger(stored.adClaimedDayKey),
    currentIndex: Math.min(timedRewardSlots.length - 1, safeInteger(stored.currentIndex)), activeMsInCycle: safeTimestamp(stored.activeMsInCycle),
  };
}

export function resetTimedRewardsForMoscowDay(state: TimedRewardState, serverNow: number): boolean {
  const dayKey = getMoscowDayKey(serverNow);
  if (state.dayKey === dayKey) return false;
  state.dayKey = dayKey;
  state.currentIndex = 0;
  state.activeMsInCycle = 0;
  state.cycle += 1;
  return true;
}

export function canClaimTimedRewardAd(state: TimedRewardState, serverNow: number): boolean {
  return true;
}

export function claimTimedRewardAd(state: TimedRewardState, inventory: TimedRewardInventory, serverNow: number): TimedRewardGrant | null {
  if (!canClaimTimedRewardAd(state, serverNow)) return null;
  inventory.parts += 400;
  return { slotIndex: -1, chest: "common", parts: 400, unlocked: [], compensated: [] };
}

export function advanceTimedRewardActiveTime(state: TimedRewardState, elapsedMs: number): void {
  if (Number.isFinite(elapsedMs) && elapsedMs > 0) state.activeMsInCycle += Math.floor(elapsedMs);
}

export function getTimedRewardSlotRemainingMs(state: TimedRewardState, index: number, _serverNow: number): number {
  const slot = timedRewardSlots[index];
  return slot ? Math.max(0, slot.unlockActiveMs - state.activeMsInCycle) : Number.POSITIVE_INFINITY;
}

export function getTimedRewardSlotViews(state: TimedRewardState, serverNow: number): TimedRewardSlotView[] {
  return timedRewardSlots.map((slot, index) => {
    const remainingMs = getTimedRewardSlotRemainingMs(state, index, serverNow);
    const status: TimedRewardSlotStatus = index < state.currentIndex ? "claimed" : index > state.currentIndex ? "locked" : remainingMs === 0 ? "ready" : "current";
    return { slot, index, remainingMs, status };
  });
}

export function claimTimedReward(state: TimedRewardState, inventory: TimedRewardInventory, index: number, serverNow: number): TimedRewardGrant | null {
  if (index !== state.currentIndex || getTimedRewardSlotRemainingMs(state, index, serverNow) > 0) return null;
  const slot = timedRewardSlots[index];
  if (!slot) return null;
  let parts = slot.parts;
  const unlocked: TimedRewardCosmetic[] = [];
  const compensated: TimedRewardCosmetic[] = [];
  const itemId = rollRewardColor(slot.colorChance);
  if (itemId) {
    const cosmetic = { kind: "color" as const, itemId, compensationParts: 500 };
    if (inventory.ownedItems.includes(itemId)) { parts += cosmetic.compensationParts; compensated.push(cosmetic); }
    else { inventory.ownedItems.push(itemId); unlocked.push(cosmetic); }
  }
  inventory.parts += parts;
  state.currentIndex += 1;
  if (state.currentIndex >= timedRewardSlots.length) { state.currentIndex = 0; state.activeMsInCycle = 0; }
  return { slotIndex: index, chest: slot.chest, parts, unlocked, compensated };
}

export function formatTimedRewardDuration(remainingMs: number): string {
  const secondsTotal = Math.max(0, Math.ceil(remainingMs / 1_000));
  const hours = Math.floor(secondsTotal / 3_600), minutes = Math.floor((secondsTotal % 3_600) / 60), seconds = secondsTotal % 60;
  return (hours === 0 ? [minutes, seconds] : [hours, minutes, seconds]).map((value) => String(value).padStart(2, "0")).join(":");
}

function rollRewardColor(chance: number): string | null {
  if (chance <= 0 || Math.random() >= chance) return null;
  const colors = colorCatalog.filter((item) => item.paymentOptions.some((payment) => payment.kind === "parts" && payment.amount === 500));
  return colors[Math.floor(Math.random() * colors.length)]?.id ?? null;
}
function safeInteger(value: unknown): number { return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0; }
function safeTimestamp(value: unknown): number { return safeInteger(value); }
function getMoscowDayKey(serverNow: number): number { return Math.floor((safeTimestamp(serverNow) + moscowUtcOffsetMs - dailyResetOffsetMs) / (24 * 60 * minuteMs)); }
