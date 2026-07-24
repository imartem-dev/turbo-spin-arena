export type CatalogCategory = "element" | "model" | "color" | "trail" | "aura";
export type PaymentOption = { kind: "parts"; amount: number } | { kind: "yan"; productId: string };
export type CatalogPreviewKind = "model" | "aura";
export type AuraStyleId = "aura_1" | "aura_2" | "aura_3";
export type CatalogItem = {
  id: string;
  category: CatalogCategory;
  labelKey: string;
  assetKey?: string;
  color?: string;
  previewKind?: CatalogPreviewKind;
  available?: boolean;
  paymentOptions: PaymentOption[];
};

export const elementCatalog: CatalogItem[] = [
  { id: "element_fire", category: "element", labelKey: "element.fire", paymentOptions: [] },
  { id: "element_ice", category: "element", labelKey: "element.ice", paymentOptions: [{ kind: "parts", amount: 800 }] },
  { id: "element_lightning", category: "element", labelKey: "element.lightning", paymentOptions: [{ kind: "parts", amount: 1600 }] },
  { id: "element_earth", category: "element", labelKey: "element.earth", paymentOptions: [{ kind: "parts", amount: 2800 }] },
];

export const modelCatalog: CatalogItem[] = [
  { id: "model_default", category: "model", labelKey: "catalog.model.default", assetKey: "spinner2", previewKind: "model", available: true, paymentOptions: [] },
  { id: "model_street", category: "model", labelKey: "catalog.model.street", assetKey: "spinner33", previewKind: "model", available: true, paymentOptions: [{ kind: "parts", amount: 3500 }] },
  { id: "model_turbo", category: "model", labelKey: "catalog.model.turbo", assetKey: "spinner44", previewKind: "model", available: true, paymentOptions: [{ kind: "parts", amount: 6000 }] },
  { id: "model_legend", category: "model", labelKey: "catalog.model.legend", assetKey: "spinner5", previewKind: "model", available: true, paymentOptions: [{ kind: "yan", productId: "model_legend" }] },
];

type ColorDefinition = { name: string; hex: string; labelKey: string };

export const baseColors: ColorDefinition[] = [
  { name: "white", hex: "#FFFFFF", labelKey: "catalog.color.white" },
  { name: "black", hex: "#000000", labelKey: "catalog.color.black" },
  { name: "yellow", hex: "#FFD700", labelKey: "catalog.color.yellow" },
  { name: "blue", hex: "#3F00FF", labelKey: "catalog.color.blue" },
  { name: "green", hex: "#00C853", labelKey: "catalog.color.green" },
  { name: "red", hex: "#FF0000", labelKey: "catalog.color.red" },
];

export const brightColors: ColorDefinition[] = [
  { name: "silver", hex: "#C9CED8", labelKey: "catalog.color.silver" },
  { name: "orange", hex: "#FF7A00", labelKey: "catalog.color.orange" },
  { name: "bronze", hex: "#B56A36", labelKey: "catalog.color.bronze" },
  { name: "sand", hex: "#E7C78B", labelKey: "catalog.color.sand" },
  { name: "azure", hex: "#168CFF", labelKey: "catalog.color.azure" },
  { name: "violet", hex: "#8A2BE2", labelKey: "catalog.color.violet" },
];

export const unusualColors: ColorDefinition[] = [
  { name: "pink", hex: "#D6005D", labelKey: "catalog.color.pink" },
  { name: "mint", hex: "#7FFFD4", labelKey: "catalog.color.mint" },
  { name: "lime", hex: "#BFFF00", labelKey: "catalog.color.lime" },
  { name: "cyan", hex: "#4CC9F0", labelKey: "catalog.color.cyan" },
  { name: "lavender", hex: "#B57EDC", labelKey: "catalog.color.lavender" },
  { name: "raspberry", hex: "#E30B5C", labelKey: "catalog.color.raspberry" },
];

export const allColors = [...baseColors, ...brightColors, ...unusualColors];

function colorPayments(name: string): PaymentOption[] {
  if (baseColors.some((entry) => entry.name === name)) return [];
  return [{ kind: "parts", amount: 500 }];
}

export const colorCatalog: CatalogItem[] = allColors.map(({ name, hex, labelKey }) => ({
  id: `color_${name}`,
  category: "color",
  labelKey,
  color: hex,
  paymentOptions: colorPayments(name),
}));

export const trailCatalog: CatalogItem[] = allColors.map(({ name, hex, labelKey }) => ({
  id: `trail_${name}`,
  category: "trail",
  labelKey,
  color: hex,
  paymentOptions: [],
}));

export const auraCatalog: CatalogItem[] = [
  { id: "aura_1", category: "aura", labelKey: "catalog.aura.one", previewKind: "aura", paymentOptions: [] },
  { id: "aura_2", category: "aura", labelKey: "catalog.aura.two", previewKind: "aura", paymentOptions: [{ kind: "parts", amount: 3000 }] },
  { id: "aura_3", category: "aura", labelKey: "catalog.aura.three", previewKind: "aura", paymentOptions: [{ kind: "yan", productId: "aura_3" }] },
];

export function isAuraStyleId(value: string): value is AuraStyleId {
  return value === "aura_1" || value === "aura_2" || value === "aura_3";
}

export const cosmeticCatalog = [...modelCatalog, ...colorCatalog, ...trailCatalog, ...auraCatalog];
