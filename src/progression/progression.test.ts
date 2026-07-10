import { describe, expect, it } from "vitest";
import { calculateMatchReward } from "./matchProgression";
import { auraCatalog, colorCatalog, trailCatalog } from "./catalog";
import { createDefaultProfile, getUpgradePrice, getUpgradeValue, grantOwnedItem, loadPlayerProfile } from "./playerProfile";

describe("match rewards", () => {
  it("rewards duel participation and victory", () => {
    expect(calculateMatchReward("duel", false, 0, 2)).toBe(20);
    expect(calculateMatchReward("duel", true, 1, 1)).toBe(50);
  });

  it("combines deathmatch participation, kills and placement", () => {
    expect(calculateMatchReward("deathmatch", false, 3, 1)).toBe(110);
    expect(calculateMatchReward("deathmatch", false, 2, 3)).toBe(70);
    expect(calculateMatchReward("deathmatch", false, 2, 7)).toBe(40);
  });
});

describe("unlimited tuning", () => {
  it("uses the specified quadratic price curve", () => {
    expect(getUpgradePrice(0)).toBe(100);
    expect(getUpgradePrice(10)).toBe(1500);
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
  it("migrates v2 cosmetics to the v3 catalogs", () => {
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
      expect(profile.version).toBe(3);
      expect(profile.selectedMaterialColors).toEqual(["color_blue", "color_yellow", "color_violet"]);
      expect(profile.selectedTrail).toBe("trail_cyan");
      expect(profile.selectedAura).toBe("aura_green");
      expect(profile.ownedItems).toContain("aura_crit");
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
    expect(colorCatalog.find((item) => item.id === "color_red")?.paymentOptions).toEqual([{ kind: "parts", amount: 250 }]);
    expect(trailCatalog.find((item) => item.id === "trail_red")?.paymentOptions).toEqual([{ kind: "parts", amount: 500 }]);
    expect(colorCatalog.find((item) => item.id === "color_mint")?.paymentOptions).toEqual([{ kind: "yan", productId: "material_color_mint" }]);
    expect(trailCatalog.find((item) => item.id === "trail_mint")?.paymentOptions).toEqual([{ kind: "yan", productId: "trail_color_mint" }]);
  });

  it("always provides crit aura and has no empty aura", () => {
    const profile = createDefaultProfile();
    expect(profile.ownedItems).toContain("aura_crit");
    expect(profile.selectedAura).toBe("aura_crit");
    expect(auraCatalog.some((item) => item.id === "aura_none")).toBe(false);
  });
});
