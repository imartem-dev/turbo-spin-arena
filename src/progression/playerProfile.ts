import type { SpinnerElement } from "../simulation/elementalSkills";
import { baseColors } from "./catalog";

export type UpgradeId = "maxRpm" | "damage" | "dash" | "ultimate";
export type UpgradeLevels = Record<UpgradeId, number>;
export type MaterialColorSelection = [string, string, string];

export type PlayerProfile = {
  version: 3;
  parts: number;
  totalMatches: number;
  wins: number;
  kills: number;
  upgrades: UpgradeLevels;
  ownedItems: string[];
  selectedElement: SpinnerElement;
  selectedMaterialColors: MaterialColorSelection;
  selectedModel: string;
  selectedAura: string;
  selectedTrail: string;
  purchases: { noAds: boolean };
};

const storageKey = "turbo-spin-arena.profile.v1";
const baseOwnedItems = [
  "model_default",
  "aura_crit",
  ...baseColors.map(({ name }) => `color_${name}`),
  ...baseColors.map(({ name }) => `trail_${name}`),
];

const legacyColorIds: Record<string, string> = {
  color_default: "color_blue",
  color_red: "color_red",
  color_blue: "color_blue",
  color_green: "color_green",
  color_violet: "color_violet",
  color_gold: "color_yellow",
};
const legacyTrailIds: Record<string, string> = {
  trail_default: "trail_white",
  trail_fire: "trail_red",
  trail_ice: "trail_cyan",
  trail_toxic: "trail_lime",
  trail_neon: "trail_violet",
  trail_gold: "trail_yellow",
};
const legacyAuraIds: Record<string, string> = {
  aura_none: "aura_crit",
  aura_fire: "aura_red",
  aura_ice: "aura_pink",
  aura_earth: "aura_green",
  aura_lightning: "aura_yellow",
};

export function createDefaultProfile(): PlayerProfile {
  return {
    version: 3,
    parts: 0,
    totalMatches: 0,
    wins: 0,
    kills: 0,
    upgrades: { maxRpm: 0, damage: 0, dash: 0, ultimate: 0 },
    ownedItems: [...baseOwnedItems],
    selectedElement: "lightning",
    selectedMaterialColors: ["color_white", "color_gray", "color_navy"],
    selectedModel: "model_default",
    selectedAura: "aura_crit",
    selectedTrail: "trail_white",
    purchases: { noAds: false },
  };
}

type StoredProfile = Omit<Partial<PlayerProfile>, "version"> & { version?: number; selectedColor?: string };

export function loadPlayerProfile(): PlayerProfile {
  const defaults = createDefaultProfile();
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? "null") as StoredProfile | null;
    if (!stored || ![1, 2, 3].includes(stored.version ?? 0)) return defaults;
    const storedOwned = Array.isArray(stored.ownedItems)
      ? stored.ownedItems.filter((item): item is string => typeof item === "string").map(migrateItemId)
      : [];
    const ownedItems = [...new Set([...baseOwnedItems, ...storedOwned])];
    const selectedMaterialColors = readMaterialColors(stored, defaults.selectedMaterialColors).map(migrateItemId) as MaterialColorSelection;
    const selectedAura = migrateItemId(typeof stored.selectedAura === "string" ? stored.selectedAura : defaults.selectedAura);
    const selectedTrail = migrateItemId(typeof stored.selectedTrail === "string" ? stored.selectedTrail : defaults.selectedTrail);
    return {
      ...defaults,
      ...stored,
      version: 3,
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
      selectedAura,
      selectedTrail,
      purchases: { noAds: stored.purchases?.noAds === true },
    };
  } catch {
    return defaults;
  }
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

export function savePlayerProfile(profile: PlayerProfile): void {
  localStorage.setItem(storageKey, JSON.stringify(profile));
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
  return 100 + 40 * level + 10 * level * level;
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
