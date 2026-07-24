import type { CatalogItem } from "../progression/catalog";
import { isSpinnerModelAssetKey, type SpinnerModelAssetKey } from "./spinnerModelLoader";

export type BotAppearance = {
  modelAssetKey: SpinnerModelAssetKey;
  colors: [string, string, string];
};

export class BotAppearanceRandomizer {
  private readonly recent: BotAppearance[] = [];

  constructor(
    private readonly models: readonly CatalogItem[],
    private readonly colors: readonly CatalogItem[],
    private readonly random: () => number = Math.random,
  ) {}

  next(): BotAppearance {
    const modelKeys = this.models.map((model) => model.assetKey).filter(isSpinnerModelAssetKey);
    const colorValues = this.colors.map((color) => color.color).filter((color): color is string => typeof color === "string");
    const appearance: BotAppearance = {
      modelAssetKey: pick(modelKeys, this.random),
      colors: [pick(colorValues, this.random), pick(colorValues, this.random), pick(colorValues, this.random)],
    };
    const last = this.recent[this.recent.length - 1];
    const previous = this.recent[this.recent.length - 2];
    if (last && previous && sameAppearance(last, previous) && sameAppearance(appearance, last)) {
      const colorIndex = colorValues.indexOf(appearance.colors[2]);
      appearance.colors[2] = colorValues[(colorIndex + 1) % colorValues.length];
    }
    this.recent.push(appearance);
    if (this.recent.length > 2) this.recent.shift();
    return appearance;
  }

}

function sameAppearance(left: BotAppearance, right: BotAppearance): boolean {
  return left.modelAssetKey === right.modelAssetKey && left.colors.every((color, index) => color === right.colors[index]);
}

function pick<T>(values: readonly T[], random: () => number): T {
  return values[Math.floor(random() * values.length)] ?? values[0];
}
