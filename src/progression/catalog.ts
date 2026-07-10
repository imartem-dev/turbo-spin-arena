export type CatalogCategory = "model" | "color" | "trail" | "aura";
export type PaymentOption = { kind: "parts"; amount: number } | { kind: "yan"; productId: string };
export type CatalogPreviewKind = "model" | "aura";
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

export const modelCatalog: CatalogItem[] = [
  { id: "model_default", category: "model", labelKey: "catalog.model.default", assetKey: "spinner2", previewKind: "model", available: true, paymentOptions: [] },
  { id: "model_street", category: "model", labelKey: "catalog.model.street", assetKey: "spinner33", previewKind: "model", available: true, paymentOptions: [{ kind: "parts", amount: 1000 }, { kind: "yan", productId: "model_street" }] },
  { id: "model_turbo", category: "model", labelKey: "catalog.model.turbo", assetKey: "spinner44", previewKind: "model", available: true, paymentOptions: [{ kind: "parts", amount: 2500 }, { kind: "yan", productId: "model_turbo" }] },
  { id: "model_legend", category: "model", labelKey: "catalog.model.legend", assetKey: "spinner5", previewKind: "model", available: true, paymentOptions: [{ kind: "parts", amount: 5000 }, { kind: "yan", productId: "model_legend" }] },
];

type ColorDefinition = { name: string; hex: string; labelKey: string };

export const baseColors: ColorDefinition[] = [
  { name: "white", hex: "#FFFFFF", labelKey: "catalog.color.white" },
  { name: "black", hex: "#000000", labelKey: "catalog.color.black" },
  { name: "gray", hex: "#808080", labelKey: "catalog.color.gray" },
  { name: "navy", hex: "#0B1F3A", labelKey: "catalog.color.navy" },
  { name: "dark_green", hex: "#0B3D2E", labelKey: "catalog.color.darkGreen" },
  { name: "burgundy", hex: "#800020", labelKey: "catalog.color.burgundy" },
];

export const brightColors: ColorDefinition[] = [
  { name: "red", hex: "#FF0000", labelKey: "catalog.color.red" },
  { name: "orange", hex: "#FF7A00", labelKey: "catalog.color.orange" },
  { name: "yellow", hex: "#FFD700", labelKey: "catalog.color.yellow" },
  { name: "blue", hex: "#3F00FF", labelKey: "catalog.color.blue" },
  { name: "green", hex: "#00C853", labelKey: "catalog.color.green" },
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

const allColors = [...baseColors, ...brightColors, ...unusualColors];

function colorPayments(name: string, partsPrice: number): PaymentOption[] {
  if (baseColors.some((entry) => entry.name === name)) return [];
  if (brightColors.some((entry) => entry.name === name)) return [{ kind: "parts", amount: partsPrice }];
  return [{ kind: "yan", productId: `material_color_${name}` }];
}

function trailPayments(name: string): PaymentOption[] {
  if (baseColors.some((entry) => entry.name === name)) return [];
  if (brightColors.some((entry) => entry.name === name)) return [{ kind: "parts", amount: 500 }];
  return [{ kind: "yan", productId: `trail_color_${name}` }];
}

export const colorCatalog: CatalogItem[] = allColors.map(({ name, hex, labelKey }) => ({
  id: `color_${name}`,
  category: "color",
  labelKey,
  color: hex,
  paymentOptions: colorPayments(name, 250),
}));

export const trailCatalog: CatalogItem[] = allColors.map(({ name, hex, labelKey }) => ({
  id: `trail_${name}`,
  category: "trail",
  labelKey,
  color: hex,
  paymentOptions: trailPayments(name),
}));

export const auraCatalog: CatalogItem[] = [
  { id: "aura_crit", category: "aura", labelKey: "catalog.aura.crit", previewKind: "aura", paymentOptions: [] },
  { id: "aura_green", category: "aura", labelKey: "catalog.aura.green", previewKind: "aura", paymentOptions: [{ kind: "parts", amount: 1000 }] },
  { id: "aura_pink", category: "aura", labelKey: "catalog.aura.pink", previewKind: "aura", paymentOptions: [{ kind: "parts", amount: 1000 }] },
  { id: "aura_red", category: "aura", labelKey: "catalog.aura.red", previewKind: "aura", paymentOptions: [{ kind: "parts", amount: 1000 }] },
  { id: "aura_yellow", category: "aura", labelKey: "catalog.aura.yellow", previewKind: "aura", paymentOptions: [{ kind: "parts", amount: 1000 }] },
];

export const cosmeticCatalog = [...modelCatalog, ...colorCatalog, ...trailCatalog, ...auraCatalog];
