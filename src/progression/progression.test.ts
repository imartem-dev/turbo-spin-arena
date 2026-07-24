import { describe, expect, it } from "vitest";
import { calculateMatchReward } from "./matchProgression";
import { auraCatalog, colorCatalog, trailCatalog } from "./catalog";
import {
  createDefaultProfile,
  getUpgradePrice,
  getUpgradeValue,
  grantOwnedItem,
  loadPlayerProfile,
  mergePlayerProfiles,
} from "./playerProfile";

describe("match rewards", () => {
  it("rewards duel participation and victory", () => {
    expect(calculateMatchReward("duel", false, 0)).toBe(100);
    expect(calculateMatchReward("duel", true, 0)).toBe(250);
  });

  it("rewards fifty parts for each earlier deathmatch elimination", () => {
    expect(calculateMatchReward("deathmatch", false, 0)).toBe(80);
    expect(calculateMatchReward("deathmatch", false, 1)).toBe(80);
    expect(calculateMatchReward("deathmatch", false, 8)).toBe(350);
    expect(calculateMatchReward("deathmatch", true, 9)).toBe(500);
    expect(calculateMatchReward("deathmatch", true, 99)).toBe(500);
  });
});

describe("unlimited tuning", () => {
  it("uses the specified quadratic price curve", () => {
    expect(getUpgradePrice(0)).toBe(250);
    expect(getUpgradePrice(10)).toBe(1750);
  });

  it("improves every stat without making dash cooldown negative", () => {
    expect(getUpgradeValue("maxRpm", 25)).toBeGreaterThan(getUpgradeValue("maxRpm", 1));
    expect(getUpgradeValue("damage", 25)).toBeGreaterThan(getUpgradeValue("damage", 1));
    expect(getUpgradeValue("ultimate", 25)).toBeGreaterThan(getUpgradeValue("ultimate", 1));
    expect(getUpgradeValue("dash", 25)).toBeLessThan(getUpgradeValue("dash", 1));
    expect(getUpgradeValue("dash", 1_000_000)).toBeGreaterThan(0);
  });
});

describe("profile migration", () => {
  it("resets legacy cosmetic purchases to the release defaults", () => {
    const storage = new Map<string, string>();
    storage.set("turbo-spin-arena.profile.v1", JSON.stringify({
      version: 2,
      selectedMaterialColors: ["color_default", "color_gold", "color_violet"],
      selectedTrail: "trail_ice",
      selectedAura: "aura_earth",
      ownedItems: ["trail_ice", "aura_earth"],
    }));
    const previousStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    });
    try {
      const profile = loadPlayerProfile();
      expect(profile.version).toBe(8);
      expect(profile.selectedMaterialColors).toEqual(["color_white", "color_yellow", "color_blue"]);
      expect(profile.selectedTrail).toBe("trail_white");
      expect(profile.selectedAura).toBe("aura_1");
      expect(profile.selectedAuraColor).toBe("color_yellow");
      expect(profile.ownedItems).toContain("aura_1");
      expect(profile.ownedItems).not.toContain("aura_2");
      expect(profile.ownedItems).not.toContain("color_violet");
    } finally {
      if (previousStorage) Object.defineProperty(globalThis, "localStorage", { configurable: true, value: previousStorage });
      else delete (globalThis as { localStorage?: Storage }).localStorage;
    }
  });

  it("grants a successful Yan unlock only once", () => {
    const profile = createDefaultProfile();
    const previousStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { setItem: () => undefined } });
    try {
      grantOwnedItem(profile, "color_mint");
      grantOwnedItem(profile, "color_mint");
      expect(profile.ownedItems.filter((item) => item === "color_mint")).toHaveLength(1);
    } finally {
      if (previousStorage) Object.defineProperty(globalThis, "localStorage", { configurable: true, value: previousStorage });
      else delete (globalThis as { localStorage?: Storage }).localStorage;
    }
  });

  it("uses the newest equipment and balance when merging cloud progress", () => {
    const local = createDefaultProfile();
    local.updatedAt = 100;
    local.parts = 50;
    const cloud = createDefaultProfile();
    cloud.updatedAt = 200;
    cloud.parts = 25;
    cloud.selectedElement = "fire";
    cloud.selectedModel = "model_turbo";
    cloud.selectedAura = "aura_2";
    cloud.selectedAuraColor = "color_mint";
    cloud.ownedItems.push("model_turbo", "aura_2");
    cloud.timedRewards.currentIndex = 3;
    cloud.timedRewards.activeMsInCycle = 1_800_000;

    const merged = mergePlayerProfiles(local, cloud);

    expect(merged.parts).toBe(25);
    expect(merged.selectedElement).toBe("fire");
    expect(merged.selectedModel).toBe("model_turbo");
    expect(merged.selectedAura).toBe("aura_2");
    expect(merged.selectedAuraColor).toBe("color_mint");
    expect(merged.ownedItems).toContain("model_turbo");
    expect(merged.timedRewards).toMatchObject({ currentIndex: 3, activeMsInCycle: 1_800_000 });
  });
});

describe("cosmetic catalogs", () => {
  it("ships 18 unique material and trail colors", () => {
    expect(colorCatalog).toHaveLength(18);
    expect(trailCatalog).toHaveLength(18);
    expect(new Set(colorCatalog.map((item) => item.color)).size).toBe(18);
    expect(new Set(trailCatalog.map((item) => item.color)).size).toBe(18);
  });

  it("uses the requested tier prices and Yan product ids", () => {
    expect(colorCatalog.find((item) => item.id === "color_white")?.paymentOptions).toEqual([]);
    expect(colorCatalog.filter((item) => item.paymentOptions.length === 0).map((item) => item.id)).toEqual([
      "color_white",
      "color_black",
      "color_yellow",
      "color_blue",
      "color_green",
      "color_red",
    ]);
    expect(colorCatalog.find((item) => item.id === "color_bronze")?.color).toBe("#B56A36");
    expect(colorCatalog.find((item) => item.id === "color_sand")?.color).toBe("#E7C78B");
    expect(colorCatalog.find((item) => item.id === "color_azure")?.color).toBe("#168CFF");
    expect(colorCatalog.find((item) => item.id === "color_silver")?.color).toBe("#C9CED8");
    expect(colorCatalog.find((item) => item.id === "color_silver")?.paymentOptions).toEqual([{ kind: "parts", amount: 500 }]);
    expect(trailCatalog.find((item) => item.id === "trail_silver")?.paymentOptions).toEqual([]);
    expect(colorCatalog.find((item) => item.id === "color_mint")?.paymentOptions).toEqual([{ kind: "parts", amount: 500 }]);
    expect(trailCatalog.find((item) => item.id === "trail_mint")?.paymentOptions).toEqual([]);
  });

  it("ships three aura forms with the requested unlock prices", () => {
    const profile = createDefaultProfile();
    expect(profile.ownedItems).toContain("aura_1");
    expect(profile.selectedAura).toBe("aura_1");
    expect(profile.selectedAuraColor).toBe("color_yellow");
    expect(auraCatalog.map((item) => item.paymentOptions)).toEqual([
      [],
      [{ kind: "parts", amount: 3000 }],
      [{ kind: "yan", productId: "aura_3" }],
    ]);
  });
});
