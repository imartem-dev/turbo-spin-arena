import type { SpinnerElement } from "../simulation/elementalSkills";
import { baseColors, colorCatalog, isAuraStyleId, type AuraStyleId } from "./catalog";
import {
  createDefaultTimedRewardState,
  parseTimedRewardState,
  type TimedRewardState,
} from "./timedRewards";

export type UpgradeId = "maxRpm" | "damage" | "dash" | "ultimate";
export type UpgradeLevels = Record<UpgradeId, number>;
export type MaterialColorSelection = [string, string, string];

export type PlayerProfile = {
  version: 8;
  updatedAt: number;
  parts: number;
  totalMatches: number;
  wins: number;
  kills: number;
  upgrades: UpgradeLevels;
  ownedItems: string[];
  selectedElement: SpinnerElement;
  selectedMaterialColors: MaterialColorSelection;
  selectedModel: string;
  selectedAura: AuraStyleId;
  selectedAuraColor: string;
  selectedTrail: string;
  purchases: { noAds: boolean };
  processedPurchaseTokens: string[];
  timedRewards: TimedRewardState;
};

const storageKey = "turbo-spin-arena.profile.v1";
const baseOwnedItems = [
  "model_default",
  "element_fire",
  "aura_1",
  ...baseColors.map(({ name }) => `color_${name}`),
  "trail_white",
];

const legacyColorIds: Record<string, string> = {
  color_default: "color_blue",
  color_red: "color_red",
  color_blue: "color_blue",
  color_green: "color_green",
  color_violet: "color_violet",
  color_gold: "color_yellow",
  color_gray: "color_red",
  color_navy: "color_yellow",
  color_dark_green: "color_blue",
  color_burgundy: "color_green",
};
const legacyTrailIds: Record<string, string> = {
  trail_default: "trail_white",
  trail_fire: "trail_red",
  trail_ice: "trail_cyan",
  trail_toxic: "trail_lime",
  trail_neon: "trail_violet",
  trail_gold: "trail_yellow",
  trail_gray: "trail_red",
  trail_navy: "trail_yellow",
  trail_dark_green: "trail_blue",
  trail_burgundy: "trail_green",
};
const legacyAuraIds: Record<string, string> = {
  aura_none: "aura_1",
  aura_fire: "aura_1",
  aura_ice: "aura_1",
  aura_earth: "aura_1",
  aura_lightning: "aura_1",
  aura_crit: "aura_1",
  aura_green: "aura_1",
  aura_pink: "aura_1",
  aura_red: "aura_1",
  aura_yellow: "aura_1",
};

export function createDefaultProfile(): PlayerProfile {
  return {
    version: 8,
    updatedAt: 0,
    parts: 0,
    totalMatches: 0,
    wins: 0,
    kills: 0,
    upgrades: { maxRpm: 0, damage: 0, dash: 0, ultimate: 0 },
    ownedItems: [...baseOwnedItems],
    selectedElement: "fire",
    selectedMaterialColors: ["color_white", "color_yellow", "color_blue"],
    selectedModel: "model_default",
    selectedAura: "aura_1",
    selectedAuraColor: "color_yellow",
    selectedTrail: "trail_white",
    purchases: { noAds: false },
    processedPurchaseTokens: [],
    timedRewards: createDefaultTimedRewardState(),
  };
}

type StoredProfile = Omit<Partial<PlayerProfile>, "version"> & { version?: number; selectedColor?: string };

export function loadPlayerProfile(): PlayerProfile {
  try {
    return parsePlayerProfile(JSON.parse(localStorage.getItem(storageKey) ?? "null")) ?? createDefaultProfile();
  } catch {
    return createDefaultProfile();
  }
}

export function parsePlayerProfile(value: unknown): PlayerProfile | null {
  if (!value || typeof value !== "object") return null;
  const stored = value as StoredProfile;
  if (![1, 2, 3, 4, 5, 6, 7, 8].includes(stored.version ?? 0)) return null;
  const defaults = createDefaultProfile();
  const isCurrentProfile = stored.version === 8;
  const storedOwned = Array.isArray(stored.ownedItems)
    ? stored.ownedItems.filter((item): item is string => typeof item === "string").map(migrateItemId)
    : [];
  const ownedItems = isCurrentProfile ? [...new Set([...baseOwnedItems, ...storedOwned])] : [...baseOwnedItems];
  const selectedMaterialColors = (isCurrentProfile ? readMaterialColors(stored, defaults.selectedMaterialColors) : defaults.selectedMaterialColors)
    .map(migrateItemId) as MaterialColorSelection;
  const selectedAura = isCurrentProfile && typeof stored.selectedAura === "string" && isAuraStyleId(stored.selectedAura)
    ? stored.selectedAura
    : defaults.selectedAura;
  const selectedAuraColor = isCurrentProfile && typeof stored.selectedAuraColor === "string" &&
    colorCatalog.some((item) => item.id === stored.selectedAuraColor)
    ? stored.selectedAuraColor
    : defaults.selectedAuraColor;
  const selectedTrail = isCurrentProfile ? migrateItemId(typeof stored.selectedTrail === "string" ? stored.selectedTrail : defaults.selectedTrail) : defaults.selectedTrail;
  const processedPurchaseTokens = Array.isArray(stored.processedPurchaseTokens)
    ? stored.processedPurchaseTokens.filter((token): token is string => typeof token === "string").slice(-100)
    : [];
  return {
    ...defaults,
    ...stored,
    version: 8,
    updatedAt: safeTimestamp(stored.updatedAt),
    parts: safeInteger(stored.parts),
    totalMatches: safeInteger(stored.totalMatches),
    wins: safeInteger(stored.wins),
    kills: safeInteger(stored.kills),
    upgrades: {
      maxRpm: safeInteger(stored.upgrades?.maxRpm),
      damage: safeInteger(stored.upgrades?.damage),
      dash: safeInteger(stored.upgrades?.dash),
      ultimate: safeInteger(stored.upgrades?.ultimate),
    },
    ownedItems: [...new Set([...ownedItems, ...selectedMaterialColors, selectedAura, selectedTrail])],
    selectedMaterialColors,
    selectedElement: isCurrentProfile && typeof stored.selectedElement === "string" ? stored.selectedElement as SpinnerElement : defaults.selectedElement,
    selectedModel: isCurrentProfile && typeof stored.selectedModel === "string" ? stored.selectedModel : defaults.selectedModel,
    selectedAura,
    selectedAuraColor,
    selectedTrail,
    purchases: { noAds: stored.purchases?.noAds === true },
    processedPurchaseTokens: [...new Set(processedPurchaseTokens)],
    timedRewards: parseTimedRewardState(stored.timedRewards),
  };
}

export function mergePlayerProfiles(local: PlayerProfile, cloud: PlayerProfile): PlayerProfile {
  const preferred = getPreferredProfile(local, cloud);
  return {
    ...preferred,
    version: 8,
    updatedAt: Math.max(local.updatedAt, cloud.updatedAt),
    parts: preferred.parts,
    totalMatches: Math.max(local.totalMatches, cloud.totalMatches),
    wins: Math.max(local.wins, cloud.wins),
    kills: Math.max(local.kills, cloud.kills),
    upgrades: {
      maxRpm: Math.max(local.upgrades.maxRpm, cloud.upgrades.maxRpm),
      damage: Math.max(local.upgrades.damage, cloud.upgrades.damage),
      dash: Math.max(local.upgrades.dash, cloud.upgrades.dash),
      ultimate: Math.max(local.upgrades.ultimate, cloud.upgrades.ultimate),
    },
    ownedItems: [...new Set([...local.ownedItems, ...cloud.ownedItems])],
    purchases: { noAds: local.purchases.noAds || cloud.purchases.noAds },
    processedPurchaseTokens: [...new Set([
      ...cloud.processedPurchaseTokens,
      ...local.processedPurchaseTokens,
    ])].slice(-100),
    timedRewards: parseTimedRewardState(preferred.timedRewards),
  };
}

function migrateItemId(itemId: string): string {
  return legacyColorIds[itemId] ?? legacyTrailIds[itemId] ?? legacyAuraIds[itemId] ?? itemId;
}

function readMaterialColors(stored: StoredProfile, fallback: MaterialColorSelection): MaterialColorSelection {
  if (Array.isArray(stored.selectedMaterialColors) && stored.selectedMaterialColors.length === 3) {
    return stored.selectedMaterialColors.map((color, index) =>
      typeof color === "string" ? color : fallback[index],
    ) as MaterialColorSelection;
  }
  return [typeof stored.selectedColor === "string" ? stored.selectedColor : fallback[0], fallback[1], fallback[2]];
}

type PlayerProfileSaveHandler = (profile: PlayerProfile) => void | Promise<void>;
let profileSaveHandler: PlayerProfileSaveHandler | null = null;

export function setPlayerProfileSaveHandler(handler: PlayerProfileSaveHandler | null): void {
  profileSaveHandler = handler;
}

export function savePlayerProfile(profile: PlayerProfile): void {
  profile.updatedAt = Date.now();
  localStorage.setItem(storageKey, JSON.stringify(profile));
  if (profileSaveHandler) {
    const snapshot = JSON.parse(JSON.stringify(profile)) as PlayerProfile;
    void profileSaveHandler(snapshot);
  }
}

export function grantOwnedItem(profile: PlayerProfile, itemId: string): void {
  if (!profile.ownedItems.includes(itemId)) profile.ownedItems.push(itemId);
  savePlayerProfile(profile);
}

export function addParts(profile: PlayerProfile, amount: number): void {
  profile.parts = Math.max(0, profile.parts + Math.max(0, Math.floor(amount)));
  savePlayerProfile(profile);
}

export function purchaseUpgrade(profile: PlayerProfile, id: UpgradeId): boolean {
  const price = getUpgradePrice(profile.upgrades[id]);
  if (profile.parts < price) return false;
  profile.parts -= price;
  profile.upgrades[id] += 1;
  savePlayerProfile(profile);
  return true;
}

export function purchaseItem(profile: PlayerProfile, itemId: string, price: number): boolean {
  if (profile.ownedItems.includes(itemId) || profile.parts < price) return false;
  profile.parts -= price;
  profile.ownedItems.push(itemId);
  savePlayerProfile(profile);
  return true;
}

export function getUpgradePrice(level: number): number {
  return 250 + 150 * level;
}

export function getUpgradeValue(id: UpgradeId, level: number): number {
  const root = Math.sqrt(Math.max(0, level));
  if (id === "maxRpm") return 1 + 0.05 * root;
  if (id === "damage") return 1 + 0.04 * root;
  if (id === "dash") return 8 / (1 + 0.05 * root);
  return 1 + 0.06 * root;
}

function safeInteger(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function safeTimestamp(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function getPreferredProfile(local: PlayerProfile, cloud: PlayerProfile): PlayerProfile {
  if (local.updatedAt !== cloud.updatedAt) return cloud.updatedAt > local.updatedAt ? cloud : local;
  return getLegacyProgressScore(cloud) > getLegacyProgressScore(local) ? cloud : local;
}

function getLegacyProgressScore(profile: PlayerProfile): number {
  const upgradeLevels = Object.values(profile.upgrades).reduce((sum, level) => sum + level, 0);
  return profile.totalMatches * 1_000_000
    + profile.wins * 10_000
    + profile.kills * 100
    + upgradeLevels * 10
    + profile.ownedItems.length;
}
