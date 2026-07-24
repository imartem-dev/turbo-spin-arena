import type { TranslationKey } from "../i18n";
import {
  formatTimedRewardDuration,
  canClaimTimedRewardAd,
  getTimedRewardSlotViews,
  timedRewardSlots,
  type TimedRewardChest,
  type TimedRewardGrant,
  type TimedRewardState,
} from "../progression/timedRewards";
import { applyTimedRewardsWindowLayout } from "./timedRewardsLayout";

type Translator = (key: TranslationKey) => string;

const goldChestImageUrls = {
  closed: `${import.meta.env.BASE_URL}assets/ui/shared/reward-chest-gold-closed.webp`,
  open: `${import.meta.env.BASE_URL}assets/ui/shared/reward-chest-gold-open.webp`,
} as const;

type TimedRewardsUiOptions = {
  t: Translator;
  onClaim: (index: number) => Promise<TimedRewardGrant | null>;
  onClaimAd: () => Promise<TimedRewardGrant | null>;
};

export class TimedRewardsUi {
  private readonly dialog: HTMLElement;
  private readonly windowElements: HTMLElement[];
  private readonly grid: HTMLElement;
  private readonly reveal: HTMLElement;
  private readonly revealItems: HTMLElement;
  private readonly compactButton: HTMLButtonElement;
  private readonly compactTimer: HTMLTimeElement;
  private readonly compactReady: HTMLElement;
  private readonly slotButtons: HTMLButtonElement[] = [];
  private claiming = false;

  constructor(private readonly options: TimedRewardsUiOptions) {
    this.dialog = requireElement<HTMLElement>("[data-timed-rewards-dialog]");
    this.windowElements = [...document.querySelectorAll<HTMLElement>(".timed-rewards-window")];
    this.grid = requireElement<HTMLElement>("[data-timed-rewards-grid]");
    this.reveal = requireElement<HTMLElement>("[data-timed-reward-reveal]");
    this.revealItems = requireElement<HTMLElement>("[data-timed-reward-items]");
    this.compactButton = requireElement<HTMLButtonElement>("[data-free-chest]");
    this.compactTimer = requireElement<HTMLTimeElement>("[data-free-chest-timer]");
    this.compactReady = requireElement<HTMLElement>("[data-free-chest-ready]");
    this.createSlots();
    this.bind();
  }

  resize(viewportWidth: number, viewportHeight: number): void {
    for (const windowElement of this.windowElements) {
      applyTimedRewardsWindowLayout(windowElement, viewportWidth, viewportHeight);
    }
  }

  setTranslator(t: Translator): void {
    this.options.t = t;
  }

  render(state: TimedRewardState, serverNow: number): void {
    const views = getTimedRewardSlotViews(state, serverNow);
    const adButton = this.slotButtons[0];
    const adReady = canClaimTimedRewardAd(state, serverNow);
    adButton.className = `timed-reward-slot is-ad is-${adReady ? "ready" : "claimed"}`;
    adButton.disabled = this.claiming || !adReady;
    const adLabel = adButton.querySelector("time")!;
    if (adReady) {
      adLabel.replaceChildren(
        Object.assign(document.createElement("span"), { className: "ui-atlas-icon icon-video", ariaHidden: "true" }),
        document.createTextNode("+400"),
      );
    } else adLabel.textContent = this.options.t("rewards.claimed");
    for (const view of views) {
      const button = this.slotButtons[view.index + 1];
      const timer = button.querySelector<HTMLTimeElement>("time");
      const chest = button.querySelector<HTMLElement>(".timed-reward-chest");
      if (!timer || !chest) continue;
      const claimed = view.status === "claimed";
      button.className = `timed-reward-slot is-${view.status}`;
      button.disabled = this.claiming || view.status !== "ready";
      button.setAttribute("aria-label", this.getStatusLabel(view.status, view.remainingMs));
      applyChestVisual(chest, view.slot.chest, claimed);
      const text = this.getStatusLabel(view.status, view.remainingMs);
      if (timer.textContent !== text) timer.textContent = text;
      timer.dateTime = `PT${Math.ceil(view.remainingMs / 1_000)}S`;
    }

    const current = views[state.currentIndex];
    const ready = current?.status === "ready";
    const compactText = ready
      ? this.options.t("rewards.open")
      : formatTimedRewardDuration(current?.remainingMs ?? 0);
    this.compactTimer.hidden = ready;
    this.compactReady.hidden = !ready;
    if (ready) this.compactReady.textContent = compactText;
    else if (this.compactTimer.textContent !== compactText) this.compactTimer.textContent = compactText;
    this.compactButton.disabled = false;
    this.compactButton.classList.toggle("is-ready", ready);
    this.compactButton.setAttribute("aria-label", this.options.t("rewards.title"));
  }

  open(): void {
    this.reveal.hidden = true;
    this.grid.hidden = false;
    this.dialog.hidden = false;
  }

  close(): void {
    this.dialog.hidden = true;
  }

  get isOpen(): boolean {
    return !this.dialog.hidden && !this.reveal.hidden;
  }

  private bind(): void {
    this.compactButton.addEventListener("click", () => this.open());
    requireElement<HTMLButtonElement>("[data-timed-rewards-close]").addEventListener("click", () => this.close());
    requireElement<HTMLButtonElement>("[data-timed-reward-continue]").addEventListener("click", () => {
      this.reveal.hidden = true;
      this.grid.hidden = false;
    });
    this.dialog.addEventListener("click", (event) => {
      if (event.target === this.dialog) this.close();
    });
  }

  private createSlots(): void {
    const adButton = this.createSlot("common");
    adButton.classList.add("is-ad");
    adButton.addEventListener("click", () => void this.claimAd());
    this.slotButtons.push(adButton);
    this.grid.append(adButton);
    for (const [index, slot] of timedRewardSlots.entries()) {
      const button = this.createSlot(slot.chest);
      button.dataset.rewardIndex = String(index);
      button.addEventListener("click", () => void this.claim(index));
      this.slotButtons.push(button);
      this.grid.append(button);
    }
  }

  private createSlot(chestType: TimedRewardChest): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "timed-reward-slot";
    const chest = Object.assign(document.createElement("span"), { className: `timed-reward-chest chest-${chestType}` });
    applyChestVisual(chest, chestType, false);
    button.append(chest, Object.assign(document.createElement("time"), { textContent: "00:00" }));
    return button;
  }

  private async claimAd(): Promise<void> {
    if (this.claiming) return;
    this.claiming = true;
    try { const grant = await this.options.onClaimAd(); if (grant) this.showGrant(grant); }
    finally { this.claiming = false; }
  }

  private async claim(index: number): Promise<void> {
    if (this.claiming) return;
    this.claiming = true;
    try {
      const grant = await this.options.onClaim(index);
      if (grant) this.showGrant(grant);
    } finally {
      this.claiming = false;
    }
  }

  private showGrant(grant: TimedRewardGrant): void {
    const items: HTMLElement[] = [createRewardItem("parts", `+${grant.parts}`, this.options.t("rewards.parts"))];
    for (const cosmetic of grant.unlocked) {
      items.push(createRewardItem("color", "", this.options.t("rewards.color"), cosmetic.itemId));
    }
    for (const cosmetic of grant.compensated) {
      items.push(createRewardItem("parts", `+${cosmetic.compensationParts}`, this.options.t("rewards.compensation")));
    }
    this.revealItems.replaceChildren(...items);
    this.grid.hidden = true;
    this.reveal.hidden = false;
  }

  private getStatusLabel(status: string, remainingMs: number): string {
    if (status === "ready") return this.options.t("rewards.open");
    if (status === "claimed" && remainingMs === 0) return this.options.t("rewards.claimed");
    return formatTimedRewardDuration(remainingMs);
  }
}

function applyChestVisual(element: HTMLElement, chest: TimedRewardChest, open: boolean): void {
  element.className = `timed-reward-chest chest-${chest}${open ? " is-open" : ""}`;
  element.style.backgroundImage = chest === "gold"
    ? `url("${open ? goldChestImageUrls.open : goldChestImageUrls.closed}")`
    : "";
}

function createRewardItem(
  kind: "parts" | "color",
  value: string,
  label: string,
  itemId?: string,
): HTMLElement {
  const item = document.createElement("div");
  item.className = `timed-reward-item item-${kind}`;
  const icon = document.createElement("span");
  icon.className = "timed-reward-item-icon";
  if (kind === "parts") {
    const image = document.createElement("img");
    image.src = `${import.meta.env.BASE_URL}assets/ui/shared/icon-currency.webp`;
    image.alt = "";
    icon.append(image);
  }
  if (itemId && kind === "color") icon.style.background = `linear-gradient(135deg, #ffffff, #3f72e5)`;
  item.append(icon, Object.assign(document.createElement("strong"), { textContent: value }), Object.assign(document.createElement("small"), { textContent: label }));
  return item;
}


function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Timed rewards UI is missing ${selector}`);
  return element;
}
