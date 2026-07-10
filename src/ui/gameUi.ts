import type { TranslationKey } from "../i18n";
import type { CatalogCategory, CatalogItem, PaymentOption } from "../progression/catalog";
import {
  getUpgradePrice,
  getUpgradeValue,
  type PlayerProfile,
  type UpgradeId,
} from "../progression/playerProfile";
import type { SpinnerElement } from "../simulation/elementalSkills";
import type { GameMode, MatchResult } from "../progression/matchProgression";

const publicAssetBaseUrl = `${import.meta.env.BASE_URL}assets/`;

export type Translate = (key: TranslationKey) => string;

export type CatalogCardState =
  | "previewing"
  | "equipped"
  | "owned"
  | "available"
  | "unavailable"
  | "insufficient";

export type WorkshopPreviewSelection = Partial<Record<CatalogCategory, string>>;
export type WorkshopCategory = "element" | CatalogCategory;

export type CatalogCardModel = {
  state: CatalogCardState;
  equipped: boolean;
  owned: boolean;
  previewing: boolean;
  partsPrice: number | null;
  hasPremiumPayment: boolean;
  unavailable: boolean;
};

export type UpgradeCardModel = {
  id: UpgradeId;
  level: number;
  currentValue: number;
  nextValue: number;
  price: number;
  canAfford: boolean;
};

export type UpgradeValueDisplay = {
  current: string;
  next: string | null;
  delta: string | null;
};

export type GameUiControllerOptions = {
  onStartMatch: () => void;
  onOpenWorkshop: (origin: "menu" | "result") => void;
  onCloseWorkshop: () => void;
  onReplay: () => void;
  onOpenMainMenu: () => void;
  onClaimDoubleReward: () => void;
};

export class GameUiController {
  private bound = false;

  constructor(private readonly options: GameUiControllerOptions) {}

  bind(): void {
    if (this.bound) return;
    this.bound = true;
    document.querySelector<HTMLButtonElement>("[data-start-match]")?.addEventListener("click", this.options.onStartMatch);
    document.querySelector<HTMLButtonElement>("[data-open-workshop]")?.addEventListener("click", () => this.options.onOpenWorkshop("menu"));
    document.querySelector<HTMLButtonElement>("[data-close-workshop]")?.addEventListener("click", this.options.onCloseWorkshop);
    document.querySelector<HTMLButtonElement>("[data-workshop-play]")?.addEventListener("click", this.options.onStartMatch);
    document.querySelector<HTMLButtonElement>("[data-result-workshop]")?.addEventListener("click", () => this.options.onOpenWorkshop("result"));
    document.querySelector<HTMLButtonElement>("[data-result-replay]")?.addEventListener("click", this.options.onReplay);
    document.querySelector<HTMLButtonElement>("[data-result-menu]")?.addEventListener("click", this.options.onOpenMainMenu);
    document.querySelector<HTMLButtonElement>("[data-result-double]")?.addEventListener("click", this.options.onClaimDoubleReward);
  }

  showMainMenu(): void {
    this.setScreenVisibility(true, false, false);
    document.body.classList.remove("match-started", "workshop-open", "result-open");
  }

  showWorkshop(): void {
    this.setScreenVisibility(false, true, false);
    document.body.classList.remove("match-started", "result-open");
    document.body.classList.add("workshop-open");
  }

  showMatch(mode: GameMode): void {
    this.setScreenVisibility(false, false, false);
    document.body.classList.remove("workshop-open", "result-open");
    document.body.classList.add("match-started");
    document.querySelector<HTMLElement>("[data-compact-leaderboard]")?.toggleAttribute("hidden", mode !== "deathmatch");
  }

  showResult(): void {
    this.setScreenVisibility(false, false, true);
    document.body.classList.remove("match-started", "workshop-open");
    document.body.classList.add("result-open");
  }

  setBusy(disabled: boolean): void {
    for (const selector of ["[data-start-match]", "[data-workshop-play]", "[data-result-replay]"]) {
      const button = document.querySelector<HTMLButtonElement>(selector);
      button?.toggleAttribute("disabled", disabled);
      if (selector === "[data-start-match]") button?.classList.toggle("is-launching", disabled);
    }
  }

  updateCurrency(parts: number): void {
    for (const element of document.querySelectorAll<HTMLElement>("[data-parts-balance]")) {
      const nextValue = String(parts);
      if (element.textContent === nextValue) continue;
      element.textContent = nextValue;
      const widget = element.closest<HTMLElement>("[data-global-currency]");
      widget?.classList.remove("currency-pop");
      requestAnimationFrame(() => widget?.classList.add("currency-pop"));
      window.setTimeout(() => widget?.classList.remove("currency-pop"), 260);
    }
  }

  private setScreenVisibility(mainMenu: boolean, workshop: boolean, result: boolean): void {
    document.querySelector<HTMLElement>("[data-start-menu]")?.toggleAttribute("hidden", !mainMenu);
    document.querySelector<HTMLElement>("[data-workshop]")?.toggleAttribute("hidden", !workshop);
    document.querySelector<HTMLElement>("[data-result-screen]")?.toggleAttribute("hidden", !result);
  }
}

type WorkshopStyleOptions = {
  root: HTMLElement;
  profile: PlayerProfile;
  items: CatalogItem[];
  previewSelection: WorkshopPreviewSelection;
  elements: readonly SpinnerElement[];
  activeMaterialSlot: 0 | 1 | 2;
  activeCategory: WorkshopCategory;
  t: Translate;
  onSelectCategory: (category: WorkshopCategory) => void;
  onSelectElement: (element: SpinnerElement) => void;
  onSelectMaterialSlot: (slot: 0 | 1 | 2) => void;
  onPreview: (item: CatalogItem) => void;
  onEquip: (item: CatalogItem) => void;
  onBuy: (item: CatalogItem, payment: PaymentOption) => void;
  onOffer: (productId: string) => void;
};

type WorkshopUpgradeOptions = {
  root: HTMLElement;
  profile: PlayerProfile;
  t: Translate;
  onUpgrade: (id: UpgradeId) => void;
};

const categoryLabelKeys: Record<CatalogCategory, TranslationKey> = {
  model: "workshop.models",
  color: "workshop.colors",
  trail: "workshop.trails",
  aura: "workshop.auras",
};
const upgradeIds: readonly UpgradeId[] = ["maxRpm", "damage", "dash", "ultimate"];
const baseMaxRpmDisplayValue = 6000;

export function getEquippedCatalogId(profile: PlayerProfile, category: CatalogCategory): string {
  if (category === "model") return profile.selectedModel;
  if (category === "color") return profile.selectedMaterialColors[0];
  if (category === "trail") return profile.selectedTrail;
  return profile.selectedAura;
}

export function deriveCatalogCardModel(
  profile: PlayerProfile,
  item: CatalogItem,
  previewedId: string | undefined,
): CatalogCardModel {
  const equipped = getEquippedCatalogId(profile, item.category) === item.id;
  const owned = profile.ownedItems.includes(item.id);
  const previewing = previewedId === item.id;
  const partsPrice = item.paymentOptions.find(
    (payment): payment is Extract<PaymentOption, { kind: "parts" }> => payment.kind === "parts",
  )?.amount ?? null;
  const hasPremiumPayment = item.paymentOptions.some((payment) => payment.kind === "yan");
  const unavailable = item.available === false;
  const state: CatalogCardState = unavailable
    ? "unavailable"
    : equipped
    ? "equipped"
    : previewing
      ? "previewing"
      : owned
        ? "owned"
        : partsPrice !== null && profile.parts < partsPrice && !hasPremiumPayment
          ? "insufficient"
          : "available";

  return { state, equipped, owned, previewing, partsPrice, hasPremiumPayment, unavailable };
}

export function deriveUpgradeCardModel(profile: PlayerProfile, id: UpgradeId): UpgradeCardModel {
  const level = profile.upgrades[id];
  const price = getUpgradePrice(level);
  return {
    id,
    level,
    currentValue: getUpgradeValue(id, level),
    nextValue: getUpgradeValue(id, level + 1),
    price,
    canAfford: profile.parts >= price,
  };
}

export function getResultStatRows(result: MatchResult, t: Translate): string[] {
  if (result.mode === "deathmatch") {
    return [`${t("result.place")}: ${result.place}`, `${t("result.kills")}: ${result.kills}`];
  }
  return [`${t("result.kills")}: ${result.kills}`];
}

export function renderWorkshopStyle(options: WorkshopStyleOptions): void {
  options.root.replaceChildren();
  const layout = document.createElement("div");
  layout.className = "workshop-appearance-layout";
  const slots = document.createElement("nav");
  slots.className = "workshop-category-slots";
  slots.setAttribute("aria-label", options.t("workshop.appearance"));
  for (const category of ["element", "model", "color", "trail", "aura"] as const) {
    slots.append(createCategorySlot(category, options));
  }
  const content = document.createElement("div");
  content.className = `workshop-category-content category-${options.activeCategory}`;
  if (options.activeCategory === "element") content.append(createElementContent(options));
  else if (options.activeCategory === "model" || options.activeCategory === "aura") {
    content.append(createCatalogGrid(options.activeCategory, options));
  } else if (options.activeCategory === "color") content.append(createMaterialContent(options));
  else content.append(createTrailContent(options));
  layout.append(slots, content);
  options.root.append(layout);
}

export function renderWorkshopUpgrades(options: WorkshopUpgradeOptions): void {
  options.root.replaceChildren();
  const upgradeSection = document.createElement("section");
  upgradeSection.className = "workshop-section workshop-upgrades";
  const grid = document.createElement("div");
  grid.className = "upgrade-grid";

  for (const id of upgradeIds) {
    const model = deriveUpgradeCardModel(options.profile, id);
    const card = document.createElement("article");
    card.className = `upgrade-card${model.canAfford ? "" : " insufficient"}`;

    const header = document.createElement("div");
    header.className = "upgrade-card-header";
    const title = document.createElement("strong");
    title.textContent = options.t(`upgrade.${id}`);
    const levelLabel = document.createElement("span");
    levelLabel.textContent = `${options.t("common.level")} ${model.level}`;
    header.append(title, levelLabel);

    const values = createUpgradeValueDisplay(id, model, options.t);

    const track = document.createElement("div");
    track.className = "upgrade-progress";
    track.setAttribute("aria-hidden", "true");
    const fill = document.createElement("span");
    fill.style.transform = `scaleX(${getUpgradeDisplayProgress(id, model.currentValue)})`;
    track.append(fill);

    const button = createPartsButton(model.price, options.t);
    button.classList.add("upgrade-action");
    button.setAttribute("aria-label", `${options.t("workshop.buy")}: ${model.price} ${options.t("parts.name")}`);
    button.disabled = !model.canAfford;
    if (!model.canAfford) button.title = options.t("workshop.insufficient");
    button.addEventListener("click", () => options.onUpgrade(id));
    card.append(header, values, track, button);
    grid.append(card);
  }

  upgradeSection.append(grid);
  options.root.append(upgradeSection);
}

export function createPartsIcon(): HTMLImageElement {
  const image = document.createElement("img");
  image.className = "parts-icon";
  image.src = `${publicAssetBaseUrl}ui/main-menu/icons/parts-token.webp`;
  image.alt = "";
  image.setAttribute("aria-hidden", "true");
  return image;
}

export function createPartsButton(amount: number, t: Translate): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "ui-button price-button";
  button.append(createPartsIcon(), Object.assign(document.createElement("span"), { textContent: String(amount) }));
  button.setAttribute("aria-label", `${amount} ${t("parts.name")}`);
  return button;
}

function createElementContent(options: WorkshopStyleOptions): HTMLElement {
  const grid = document.createElement("div");
  grid.className = "workshop-card-grid element-grid";
  for (const element of options.elements) {
    const selected = options.profile.selectedElement === element;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `workshop-large-card element-card element-tile element-${element}${selected ? " selected" : ""}`;
    button.setAttribute("aria-label", options.t(`element.${element}`));
    button.setAttribute("aria-pressed", String(selected));
    button.addEventListener("click", () => options.onSelectElement(element));
    if (selected) button.append(createStateIcon("check"));
    grid.append(button);
  }
  return grid;
}

function createCatalogGrid(category: "model" | "aura", options: WorkshopStyleOptions): HTMLElement {
  const viewport = document.createElement("div");
  viewport.className = "workshop-category-scroll";
  viewport.tabIndex = 0;
  viewport.setAttribute("aria-label", options.t(categoryLabelKeys[category]));
  const grid = document.createElement("div");
  grid.className = "workshop-card-grid catalog-grid";
  for (const item of options.items.filter((candidate) => candidate.category === category)) {
    grid.append(createWorkshopCatalogTile(item, options));
  }
  viewport.append(grid);
  return viewport;
}

function createMaterialContent(options: WorkshopStyleOptions): HTMLElement {
  const editor = document.createElement("div");
  editor.className = "material-editor";
  const slots = document.createElement("div");
  slots.className = "material-slots";
  options.profile.selectedMaterialColors.forEach((_colorId, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `material-slot${options.activeMaterialSlot === index ? " active" : ""}`;
    button.setAttribute("aria-label", `${options.t("workshop.colors")} ${index + 1}`);
    button.setAttribute("aria-pressed", String(options.activeMaterialSlot === index));
    const preview = document.createElement("span");
    preview.className = "workshop-item-webgl-preview material-mask-preview";
    preview.dataset.workshopWebglKind = "material-mask";
    preview.dataset.itemId = options.profile.selectedModel;
    preview.dataset.materialSlot = String(index);
    button.append(preview);
    button.addEventListener("click", () => options.onSelectMaterialSlot(index as 0 | 1 | 2));
    slots.append(button);
  });
  const palette = document.createElement("div");
  palette.className = "material-palette";
  for (const item of options.items.filter((candidate) => candidate.category === "color")) {
    const selected = options.profile.selectedMaterialColors[options.activeMaterialSlot] === item.id;
    const owned = options.profile.ownedItems.includes(item.id);
    const wrapper = document.createElement("div");
    wrapper.className = "palette-item";
    const button = document.createElement("button");
    button.type = "button";
    button.className = `palette-swatch${selected ? " selected" : ""}`;
    button.style.setProperty("--swatch-color", item.color ?? "#fff");
    button.setAttribute("aria-label", options.t(item.labelKey as TranslationKey));
    button.setAttribute("aria-pressed", String(selected));
    button.addEventListener("click", () => {
      if (owned) options.onEquip(item);
      else options.onPreview(item);
    });
    if (selected) button.append(createStateIcon("check"));
    wrapper.append(button, createPalettePriceArea(item, owned, options));
    palette.append(wrapper);
  }
  editor.append(slots, palette);
  return editor;
}

function createTrailContent(options: WorkshopStyleOptions): HTMLElement {
  const palette = document.createElement("div");
  palette.className = "material-palette trail-palette";
  for (const item of options.items.filter((candidate) => candidate.category === "trail")) {
    const selected = options.profile.selectedTrail === item.id;
    const owned = options.profile.ownedItems.includes(item.id);
    const wrapper = document.createElement("div");
    wrapper.className = "palette-item";
    const button = document.createElement("button");
    button.type = "button";
    button.className = `palette-swatch${selected ? " selected" : ""}`;
    button.style.setProperty("--swatch-color", item.color ?? "#fff");
    button.setAttribute("aria-label", options.t(item.labelKey as TranslationKey));
    button.setAttribute("aria-pressed", String(selected));
    button.addEventListener("click", () => owned ? options.onEquip(item) : options.onPreview(item));
    if (selected) button.append(createStateIcon("check"));
    wrapper.append(button, createPalettePriceArea(item, owned, options));
    palette.append(wrapper);
  }
  return palette;
}

function createCategorySlot(category: WorkshopCategory, options: WorkshopStyleOptions): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `workshop-category-slot slot-${category}${options.activeCategory === category ? " active" : ""}`;
  const labelKey = category === "element" ? "workshop.elements" : categoryLabelKeys[category];
  button.setAttribute("aria-label", options.t(labelKey));
  button.setAttribute("aria-pressed", String(options.activeCategory === category));
  if (category === "element") {
    const icon = document.createElement("span");
    icon.className = `slot-element-icon element-${options.profile.selectedElement}`;
    button.append(icon);
  } else if (category === "model" || category === "aura") {
    const preview = document.createElement("span");
    preview.className = "workshop-item-webgl-preview slot-webgl-preview";
    preview.dataset.workshopWebglKind = category === "model" ? "model-slot" : "aura-slot";
    preview.dataset.itemId = category === "model" ? options.profile.selectedModel : options.profile.selectedAura;
    preview.dataset.active = "false";
    button.append(preview);
  } else if (category === "trail") {
    const trail = options.items.find((item) => item.id === options.profile.selectedTrail);
    const icon = document.createElement("span");
    icon.className = "slot-trail-icon";
    icon.style.setProperty("--swatch-color", trail?.color ?? "#fff");
    button.append(icon);
  } else {
    const image = document.createElement("img");
    image.src = `${publicAssetBaseUrl}ui/workshop/icons/color.webp`;
    image.alt = "";
    button.append(image);
  }
  button.addEventListener("click", () => options.onSelectCategory(category));
  return button;
}

function createPalettePriceArea(item: CatalogItem, owned: boolean, options: WorkshopStyleOptions): HTMLElement {
  const area = document.createElement("div");
  area.className = "palette-price-area";
  if (owned) return area;
  const payment = item.paymentOptions[0];
  if (!payment) return area;
  const buy = payment.kind === "parts" ? createPartsButton(payment.amount, options.t) : createPremiumButton(options.t);
  buy.classList.add("palette-price");
  if (payment.kind === "parts") buy.disabled = options.profile.parts < payment.amount;
  buy.addEventListener("click", () => options.onBuy(item, payment));
  area.append(buy);
  return area;
}

function createWorkshopCatalogTile(item: CatalogItem, options: WorkshopStyleOptions): HTMLElement {
  const selectedId = options.previewSelection[item.category] ?? getEquippedCatalogId(options.profile, item.category);
  const model = deriveCatalogCardModel(options.profile, item, selectedId);
  const card = document.createElement("article");
  card.className = `workshop-item-card workshop-large-card category-${item.category} state-${model.state}`;
  card.dataset.itemId = item.id;
  const select = document.createElement("button");
  select.type = "button";
  select.className = "workshop-item-tile";
  select.setAttribute("aria-label", options.t(item.labelKey as TranslationKey));
  select.disabled = model.unavailable;
  if (item.previewKind) {
    const preview = document.createElement("span");
    preview.className = "workshop-item-webgl-preview";
    preview.dataset.workshopWebglKind = item.previewKind;
    preview.dataset.itemId = item.id;
    preview.dataset.active = String(model.previewing || model.equipped);
    select.append(preview);
  } else if (item.color) {
    const swatch = document.createElement("span");
    swatch.className = "workshop-trail-swatch";
    swatch.style.setProperty("--swatch-color", item.color);
    select.append(swatch);
  }
  if (model.equipped) select.append(createStateIcon("check"));
  if (model.unavailable) select.append(createStateIcon("lock"));
  select.addEventListener("click", () => model.owned ? options.onEquip(item) : options.onPreview(item));
  card.append(select);
  const priceArea = document.createElement("div");
  priceArea.className = "workshop-card-price-area";
  if (!model.owned && !model.unavailable) {
    const payment = item.paymentOptions.find((candidate) => candidate.kind === "parts") ?? item.paymentOptions[0];
    if (payment) {
      const buy = payment.kind === "parts" ? createPartsButton(payment.amount, options.t) : createPremiumButton(options.t);
      if (payment.kind === "parts" && options.profile.parts < payment.amount) buy.disabled = true;
      buy.addEventListener("click", () => options.onBuy(item, payment));
      priceArea.append(buy);
    }
  }
  card.append(priceArea);
  return card;
}

function createWorkshopArrow(direction: "previous" | "next", label: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `workshop-arrow ${direction}`;
  button.setAttribute("aria-label", label);
  const image = document.createElement("img");
  image.src = `${publicAssetBaseUrl}ui/workshop/icons/${direction}.webp`;
  image.alt = "";
  button.append(image);
  return button;
}

function createStateIcon(name: "check" | "lock"): HTMLImageElement {
  const image = document.createElement("img");
  image.className = `workshop-state-icon ${name}`;
  image.src = `${publicAssetBaseUrl}ui/workshop/icons/${name}.webp`;
  image.alt = "";
  image.setAttribute("aria-hidden", "true");
  return image;
}

function setupWorkshopRowNavigation(
  viewport: HTMLElement,
  previous: HTMLButtonElement,
  next: HTMLButtonElement,
): void {
  const update = (): void => {
    previous.disabled = viewport.scrollLeft <= 2;
    next.disabled = viewport.scrollLeft + viewport.clientWidth >= viewport.scrollWidth - 2;
  };
  const move = (direction: number): void => viewport.scrollBy({
    left: direction * viewport.clientWidth * 0.72,
    behavior: "smooth",
  });
  previous.addEventListener("click", () => move(-1));
  next.addEventListener("click", () => move(1));
  viewport.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    move(event.key === "ArrowLeft" ? -1 : 1);
  });
  viewport.addEventListener("scroll", update, { passive: true });
  requestAnimationFrame(update);
}

function createCarouselSection(
  category: CatalogCategory,
  items: CatalogItem[],
  selectedId: string,
  options: WorkshopStyleOptions,
): HTMLElement {
  const section = document.createElement("section");
  section.className = "workshop-section carousel-section";
  const header = document.createElement("div");
  header.className = "section-header";
  header.append(createSectionTitle(options.t(categoryLabelKeys[category])));

  const controls = document.createElement("div");
  controls.className = "carousel-controls";
  const previous = createArrowButton("previous", options.t("common.previous"));
  const next = createArrowButton("next", options.t("common.next"));
  controls.append(previous, next);
  header.append(controls);

  const viewport = document.createElement("div");
  viewport.className = "carousel-viewport";
  viewport.tabIndex = 0;
  const track = document.createElement("div");
  track.className = "carousel-track";
  const cards = items.map((item) => createCatalogCard(item, selectedId, options));
  track.append(...cards);
  viewport.append(track);
  section.append(header, viewport);
  setupCarousel(viewport, cards, Math.max(0, items.findIndex((item) => item.id === selectedId)), (index) => {
    const item = items[index];
    if (item) options.onPreview(item);
  }, previous, next, options.t("workshop.previewing"));
  return section;
}

function createCatalogCard(item: CatalogItem, previewedId: string, options: WorkshopStyleOptions): HTMLElement {
  const model = deriveCatalogCardModel(options.profile, item, previewedId);
  const card = document.createElement("article");
  card.className = `carousel-card state-${model.state}${model.hasPremiumPayment ? " premium" : ""}`;
  card.dataset.itemId = item.id;
  card.dataset.equipped = String(model.equipped);
  card.tabIndex = -1;

  const visual = document.createElement("div");
  visual.className = "item-visual";
  if (item.color) visual.style.setProperty("--item-color", item.color);
  visual.append(createCategoryGlyph(item));

  const title = document.createElement("strong");
  title.className = "item-title";
  title.textContent = options.t(item.labelKey as TranslationKey);

  const badge = document.createElement("span");
  badge.className = "item-state-badge";
  badge.textContent = model.equipped
    ? options.t("workshop.equipped")
    : model.previewing
      ? options.t("workshop.previewing")
      : model.owned
        ? options.t("workshop.owned")
        : model.hasPremiumPayment
          ? options.t("workshop.premium")
          : options.t("workshop.available");
  badge.dataset.baseLabel = badge.textContent;

  const actions = document.createElement("div");
  actions.className = "item-actions";
  if (model.owned) {
    const equip = document.createElement("button");
    equip.type = "button";
    equip.className = "ui-button secondary compact";
    equip.textContent = model.equipped ? options.t("workshop.equipped") : options.t("workshop.equip");
    equip.disabled = model.equipped;
    equip.addEventListener("click", (event) => {
      event.stopPropagation();
      options.onEquip(item);
    });
    actions.append(equip);
  } else {
    for (const payment of item.paymentOptions) {
      const button = payment.kind === "parts"
        ? createPartsButton(payment.amount, options.t)
        : createPremiumButton(options.t);
      if (payment.kind === "parts" && options.profile.parts < payment.amount) {
        button.disabled = true;
        button.title = options.t("workshop.insufficient");
      }
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        options.onBuy(item, payment);
      });
      actions.append(button);
    }
  }

  card.append(visual, title, badge, actions);
  return card;
}

function createOffersSection(options: WorkshopStyleOptions): HTMLElement {
  const section = document.createElement("section");
  section.className = "workshop-section offers-section";
  section.append(createSectionTitle(options.t("workshop.offers")));
  const offers = document.createElement("div");
  offers.className = "offer-grid";
  for (const [titleKey, productId] of [
    ["offer.noAds", "no_ads"],
    ["offer.parts500", "parts_500"],
    ["offer.parts3000", "parts_3000"],
  ] as const) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "offer-card";
    button.append(
      Object.assign(document.createElement("strong"), { textContent: options.t(titleKey) }),
      Object.assign(document.createElement("span"), { textContent: options.t("workshop.premium") }),
    );
    button.addEventListener("click", () => options.onOffer(productId));
    offers.append(button);
  }
  section.append(offers);
  return section;
}

function setupCarousel(
  viewport: HTMLElement,
  cards: HTMLElement[],
  initialIndex: number,
  onSelect: (index: number) => void,
  previous: HTMLButtonElement,
  next: HTMLButtonElement,
  previewLabel: string,
): void {
  let selectedIndex = initialIndex;
  let scrollTimer = 0;
  let pointerId: number | null = null;
  let pointerStartX = 0;
  let scrollStart = 0;

  const updateSelection = (index: number, emit: boolean): void => {
    selectedIndex = Math.max(0, Math.min(cards.length - 1, index));
    cards.forEach((card, cardIndex) => {
      const active = cardIndex === selectedIndex;
      card.classList.toggle("previewing", active);
      card.setAttribute("aria-current", active ? "true" : "false");
      const badge = card.querySelector<HTMLElement>(".item-state-badge");
      if (badge) {
        badge.textContent = active && card.dataset.equipped !== "true"
          ? previewLabel
          : badge.dataset.baseLabel ?? "";
      }
    });
    previous.disabled = selectedIndex <= 0;
    next.disabled = selectedIndex >= cards.length - 1;
    if (emit) onSelect(selectedIndex);
  };

  const centerCard = (index: number, emit = true): void => {
    const card = cards[index];
    if (!card) return;
    const target = card.offsetLeft - (viewport.clientWidth - card.clientWidth) * 0.5;
    viewport.scrollTo({ left: target, behavior: "smooth" });
    updateSelection(index, emit);
  };

  const selectNearest = (): void => {
    const center = viewport.scrollLeft + viewport.clientWidth * 0.5;
    let nearest = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    cards.forEach((card, index) => {
      const distance = Math.abs(card.offsetLeft + card.clientWidth * 0.5 - center);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = index;
      }
    });
    updateSelection(nearest, nearest !== selectedIndex);
  };

  cards.forEach((card, index) => card.addEventListener("click", () => centerCard(index)));
  previous.addEventListener("click", () => centerCard(selectedIndex - 1));
  next.addEventListener("click", () => centerCard(selectedIndex + 1));
  viewport.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    centerCard(selectedIndex + (event.key === "ArrowLeft" ? -1 : 1));
  });
  viewport.addEventListener("wheel", (event) => {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    viewport.scrollBy({ left: event.deltaY, behavior: "auto" });
  }, { passive: false });
  viewport.addEventListener("scroll", () => {
    window.clearTimeout(scrollTimer);
    scrollTimer = window.setTimeout(selectNearest, 90);
  }, { passive: true });
  viewport.addEventListener("pointerdown", (event) => {
    if ((event.target as HTMLElement).closest("button")) return;
    pointerId = event.pointerId;
    pointerStartX = event.clientX;
    scrollStart = viewport.scrollLeft;
    viewport.setPointerCapture(event.pointerId);
    viewport.classList.add("dragging");
  });
  viewport.addEventListener("pointermove", (event) => {
    if (event.pointerId !== pointerId) return;
    viewport.scrollLeft = scrollStart - (event.clientX - pointerStartX);
  });
  const endDrag = (event: PointerEvent): void => {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    viewport.classList.remove("dragging");
    selectNearest();
  };
  viewport.addEventListener("pointerup", endDrag);
  viewport.addEventListener("pointercancel", endDrag);

  updateSelection(initialIndex, false);
  requestAnimationFrame(() => centerCard(initialIndex, false));
}

function createSectionTitle(label: string): HTMLElement {
  const title = document.createElement("h3");
  title.className = "section-title";
  title.textContent = label;
  return title;
}

function createArrowButton(direction: "previous" | "next", label: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `carousel-arrow ${direction}`;
  button.setAttribute("aria-label", label);
  button.textContent = direction === "previous" ? "‹" : "›";
  return button;
}

function createPremiumButton(t: Translate): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "ui-button premium-button";
  button.textContent = t("workshop.yan");
  return button;
}

function createCategoryGlyph(item: CatalogItem): HTMLElement {
  const glyph = document.createElement("span");
  glyph.className = `category-glyph glyph-${item.category}`;
  glyph.setAttribute("aria-hidden", "true");
  return glyph;
}

function createElementGlyph(element: SpinnerElement): HTMLElement {
  const glyph = document.createElement("span");
  glyph.className = `element-glyph element-${element}`;
  glyph.setAttribute("aria-hidden", "true");
  return glyph;
}

function createUpgradeValueDisplay(id: UpgradeId, model: UpgradeCardModel, t: Translate): HTMLElement {
  const display = formatUpgradeValueDisplay(id, model.currentValue, model.nextValue, t);
  const values = document.createElement("div");
  values.className = "upgrade-values";

  const current = document.createElement("span");
  current.className = "upgrade-value-current";
  current.textContent = display.current;
  values.append(current);

  if (display.delta) {
    const delta = document.createElement("span");
    delta.className = "upgrade-value-delta";
    delta.textContent = display.delta;
    values.append(delta);
  } else if (display.next) {
    const arrow = document.createElement("span");
    arrow.className = "upgrade-value-arrow";
    arrow.textContent = "→";
    const next = document.createElement("span");
    next.className = "upgrade-value-next";
    next.textContent = display.next;
    values.append(arrow, next);
  }

  return values;
}

export function formatUpgradeValueDisplay(
  id: UpgradeId,
  currentValue: number,
  nextValue: number,
  t: Translate,
): UpgradeValueDisplay {
  if (id === "maxRpm") {
    const current = Math.round(baseMaxRpmDisplayValue * currentValue);
    const next = Math.round(baseMaxRpmDisplayValue * nextValue);
    return { current: String(current), next: null, delta: formatSignedInteger(next - current) };
  }

  if (id === "dash") {
    const unit = t("unit.secondsShort");
    return {
      current: `${currentValue.toFixed(2)} ${unit}`,
      next: `${nextValue.toFixed(2)} ${unit}`,
      delta: null,
    };
  }

  return {
    current: formatUpgradePercent(currentValue),
    next: formatUpgradePercent(nextValue),
    delta: null,
  };
}

function formatUpgradePercent(value: number): string {
  return `${formatSignedInteger(Math.round((value - 1) * 100))}%`;
}

function formatSignedInteger(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

function getUpgradeDisplayProgress(id: UpgradeId, value: number): number {
  if (id === "dash") return Math.min(1, Math.max(0.08, (8 - value) / 4));
  return Math.min(1, Math.max(0.08, (value - 1) / 0.5));
}
