import { describe, expect, it } from "vitest";
import type { TranslationKey } from "../i18n";
import { colorCatalog, modelCatalog } from "../progression/catalog";
import { createDefaultProfile } from "../progression/playerProfile";
import type { MatchResult } from "../progression/matchProgression";
import {
  deriveCatalogCardModel,
  deriveUpgradeCardModel,
  formatUpgradeValueDisplay,
  getResultStatRows,
} from "./gameUi";
import { selectCompactLeaderboardRows, type LeaderboardViewRow } from "./combatHud";

const translate = (key: TranslationKey): string => key;

describe("workshop UI models", () => {
  it("keeps preview state separate from the equipped profile item", () => {
    const profile = createDefaultProfile();
    const red = colorCatalog.find((item) => item.id === "color_red");
    expect(red).toBeDefined();

    const model = deriveCatalogCardModel(profile, red!, "color_red");
    expect(model.previewing).toBe(true);
    expect(model.equipped).toBe(false);
    expect(profile.selectedMaterialColors).toEqual(["color_white", "color_gray", "color_navy"]);
  });

  it("distinguishes equipped, insufficient, and premium purchase states", () => {
    const profile = createDefaultProfile();
    const equipped = deriveCatalogCardModel(profile, colorCatalog[0], undefined);
    const insufficient = deriveCatalogCardModel(profile, colorCatalog.find((item) => item.id === "color_red")!, undefined);
    const premium = deriveCatalogCardModel(
      profile,
      modelCatalog.find((item) => item.id === "model_street")!,
      undefined,
    );

    expect(equipped.state).toBe("equipped");
    expect(insufficient.state).toBe("insufficient");
    expect(premium.state).toBe("available");
    expect(premium.hasPremiumPayment).toBe(true);
  });

  it("makes every shipped model slot available for purchase", () => {
    const profile = createDefaultProfile();
    const purchasable = modelCatalog.slice(1).map((item) => deriveCatalogCardModel(profile, item, undefined));
    expect(purchasable.every((model) => model.state === "available")).toBe(true);
    expect(purchasable.every((model) => model.unavailable === false)).toBe(true);
  });

  it("derives upgrade values and affordability from progression data", () => {
    const profile = createDefaultProfile();
    profile.parts = 99;
    const unavailable = deriveUpgradeCardModel(profile, "damage");
    profile.parts = 100;
    const available = deriveUpgradeCardModel(profile, "damage");

    expect(unavailable.canAfford).toBe(false);
    expect(available.canAfford).toBe(true);
    expect(available.nextValue).toBeGreaterThan(available.currentValue);
  });

  it("formats upgrade card values as player-facing values", () => {
    const secondsTranslate = (key: TranslationKey): string => (key === "unit.secondsShort" ? "сек" : key);

    expect(formatUpgradeValueDisplay("maxRpm", 1, 1.025, translate)).toEqual({
      current: "6000",
      next: null,
      delta: "+150",
    });
    expect(formatUpgradeValueDisplay("damage", 1, 1.02, translate)).toEqual({
      current: "+0%",
      next: "+2%",
      delta: null,
    });
    expect(formatUpgradeValueDisplay("ultimate", 1, 1.03, translate)).toEqual({
      current: "+0%",
      next: "+3%",
      delta: null,
    });
    expect(formatUpgradeValueDisplay("dash", 8, 7.5, secondsTranslate)).toEqual({
      current: "8.00 сек",
      next: "7.50 сек",
      delta: null,
    });
  });
});

describe("mode-specific UI models", () => {
  it("shows placement only for deathmatch results", () => {
    const duel: MatchResult = { mode: "duel", outcome: "victory", place: 1, kills: 1, partsEarned: 50, bonusClaimed: false };
    const deathmatch: MatchResult = { mode: "deathmatch", outcome: "placed", place: 3, kills: 4, partsEarned: 90, bonusClaimed: false };

    expect(getResultStatRows(duel, translate)).toEqual(["result.kills: 1"]);
    expect(getResultStatRows(deathmatch, translate)).toEqual(["result.place: 3", "result.kills: 4"]);
  });

  it("keeps top three leaderboard rows plus an out-of-range player row", () => {
    const rows: LeaderboardViewRow[] = Array.from({ length: 6 }, (_, index) => ({
      id: String(index + 1),
      rank: index + 1,
      name: `Bot ${index + 1}`,
      kills: 0,
      deaths: 0,
      criticalHits: 0,
      rating: 100 - index,
      player: index === 5,
      respawning: false,
      invulnerable: false,
    }));

    expect(selectCompactLeaderboardRows(rows).map((row) => row.rank)).toEqual([1, 2, 3, 6]);
  });
});
