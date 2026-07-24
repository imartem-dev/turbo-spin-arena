import { describe, expect, it } from "vitest";
import { colorCatalog, modelCatalog } from "../progression/catalog";
import { BotAppearanceRandomizer } from "./botAppearance";

describe("BotAppearanceRandomizer", () => {
  it("uses the complete model and color catalogs", () => {
    const randomizer = new BotAppearanceRandomizer(modelCatalog, colorCatalog, () => 0.999999);
    expect(randomizer.next()).toEqual({ modelAssetKey: "spinner5", colors: ["#E30B5C", "#E30B5C", "#E30B5C"] });
  });

  it("chooses all three material colors independently", () => {
    const values = [0, 0, 0.5, 0.999999];
    const randomizer = new BotAppearanceRandomizer(modelCatalog, colorCatalog, () => values.shift() ?? 0);
    expect(randomizer.next().colors).toEqual(["#FFFFFF", "#E7C78B", "#E30B5C"]);
  });

  it("allows two equal appearances but prevents a third", () => {
    const randomizer = new BotAppearanceRandomizer(modelCatalog, colorCatalog, () => 0);
    const first = randomizer.next();
    expect(randomizer.next()).toEqual(first);
    expect(randomizer.next()).not.toEqual(first);
  });

  it("continues producing a new series for later matches", () => {
    const values = [0, 0.5];
    const randomizer = new BotAppearanceRandomizer(modelCatalog, colorCatalog, () => values.shift() ?? 0.75);
    expect(randomizer.next()).not.toEqual(randomizer.next());
  });
});
