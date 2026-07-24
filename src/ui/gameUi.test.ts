import { describe, expect, it } from "vitest";
import type { TranslationKey } from "../i18n";
import { auraCatalog, colorCatalog, modelCatalog } from "../progression/catalog";
import { createDefaultProfile } from "../progression/playerProfile";
import {
  deriveCatalogCardModel,
  deriveUpgradeCardModel,
  formatUpgradeValueDisplay,
} from "./gameUi";
import { formatAliveCounter } from "./combatHud";

const translate = (key: TranslationKey): string => key;

describe("workshop UI models", () => {
  it("keeps preview state separate from the equipped profile item", () => {
    const profile = createDefaultProfile();
    const red = colorCatalog.find((item) => item.id === "color_red");
    expect(red).toBeDefined();

    const model = deriveCatalogCardModel(profile, red!, "color_red");
    expect(model.previewing).toBe(true);
    expect(model.equipped).toBe(false);
    expect(profile.selectedMaterialColors).toEqual(["color_white", "color_yellow", "color_blue"]);
  });

  it("distinguishes equipped, insufficient, and premium purchase states", () => {
    const profile = createDefaultProfile();
    const equipped = deriveCatalogCardModel(profile, colorCatalog[0], undefined);
    const insufficient = deriveCatalogCardModel(profile, colorCatalog.find((item) => item.id === "color_silver")!, undefined);
    const premium = deriveCatalogCardModel(
      profile,
      modelCatalog.find((item) => item.id === "model_legend")!,
      undefined,
    );

    expect(equipped.state).toBe("equipped");
    expect(insufficient.state).toBe("insufficient");
    expect(premium.state).toBe("available");
    expect(premium.hasPremiumPayment).toBe(true);
  });

  it("makes every shipped model slot purchasable", () => {
    const profile = createDefaultProfile();
    profile.parts = 12_000;
    const purchasable = modelCatalog.slice(1).map((item) => deriveCatalogCardModel(profile, item, undefined));
    expect(purchasable.every((model) => model.state === "available")).toBe(true);
    expect(purchasable.every((model) => model.unavailable === false)).toBe(true);
  });

  it("keeps an unowned aura preview separate from the equipped form and color", () => {
    const profile = createDefaultProfile();
    const preview = deriveCatalogCardModel(profile, auraCatalog[1], "aura_2");

    expect(preview.previewing).toBe(true);
    expect(preview.equipped).toBe(false);
    expect(preview.owned).toBe(false);
    expect(preview.partsPrice).toBe(3000);
    expect(profile.selectedAura).toBe("aura_1");
    expect(profile.selectedAuraColor).toBe("color_yellow");
  });

  it("derives upgrade values and affordability from progression data", () => {
    const profile = createDefaultProfile();
    profile.parts = 99;
    const unavailable = deriveUpgradeCardModel(profile, "damage");
    profile.parts = 250;
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
  it("formats the deathmatch HUD as a bare alive fraction", () => {
    expect(formatAliveCounter(10, 10)).toBe("10/10");
    expect(formatAliveCounter(9, 10)).toBe("9/10");
    expect(formatAliveCounter(1, 10)).toBe("1/10");
  });
});
