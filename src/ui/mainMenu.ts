import type { TranslationKey } from "../i18n";
import type { GameMode } from "../progression/matchProgression";

type Translator = (key: TranslationKey) => string;

type MainMenuOptions = {
  initialMode: GameMode;
  devMode: boolean;
  t: Translator;
  onModeSelected: (mode: GameMode) => void;
  onClaimFreeChest: () => number;
};

const soundStorageKey = "turbo-spin-arena:menu-sound";
const freeChestReadyAtStorageKey = "turbo-spin-arena:free-chest-ready-at-v2";
const freeChestCountdownMs = ((2 * 60 + 15) * 60 + 47) * 1000;

export function setupMainMenu(options: MainMenuOptions): void {
  const menu = document.querySelector<HTMLElement>("[data-start-menu]");
  const startButton = document.querySelector<HTMLButtonElement>("[data-start-match]");
  if (!menu || !startButton) {
    throw new Error("Start menu controls are missing.");
  }

  configureDevelopmentControls(options.devMode);
  applyTranslations(options.t);
  bindModeSelection(options.initialMode, options.onModeSelected);
  bindSoundControl(options.t);
  bindSettingsControl();
  bindFreeChest(options.t, options.onClaimFreeChest);
}

function bindModeSelection(initialMode: GameMode, onModeSelected: (mode: GameMode) => void): void {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-game-mode]"));

  const selectMode = (mode: GameMode): void => {
    for (const button of buttons) {
      const active = button.dataset.gameMode === mode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    }
    onModeSelected(mode);
  };

  for (const button of buttons) {
    button.addEventListener("click", () => {
      selectMode(button.dataset.gameMode === "deathmatch" ? "deathmatch" : "duel");
    });
  }

  selectMode(initialMode);
}

function bindSoundControl(t: Translator): void {
  const button = document.querySelector<HTMLButtonElement>("[data-menu-sound]");
  if (!button) return;

  let soundEnabled = localStorage.getItem(soundStorageKey) !== "off";

  const render = (): void => {
    button.classList.toggle("sound-off", !soundEnabled);
    button.setAttribute("aria-pressed", String(soundEnabled));
    button.setAttribute("aria-label", t(soundEnabled ? "menu.sound" : "menu.soundOff"));
    button.title = button.getAttribute("aria-label") ?? "";
    document.body.classList.toggle("sound-muted", !soundEnabled);
  };

  button.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    localStorage.setItem(soundStorageKey, soundEnabled ? "on" : "off");
    render();
  });

  render();
}

function bindSettingsControl(): void {
  const button = document.querySelector<HTMLButtonElement>("[data-menu-settings]");
  const controls = document.querySelector<HTMLDetailsElement>("[data-dev-controls]");
  if (!button || !controls) return;

  button.addEventListener("click", () => {
    const willOpen = controls.hidden;
    controls.hidden = !controls.hidden;
    controls.open = willOpen;
  });
}

function configureDevelopmentControls(devMode: boolean): void {
  const controls = document.querySelector<HTMLElement>("[data-dev-controls]");
  if (!devMode) controls?.remove();
}

function bindFreeChest(t: Translator, onClaim: () => number): void {
  const button = document.querySelector<HTMLButtonElement>("[data-free-chest]");
  const timer = document.querySelector<HTMLTimeElement>("[data-free-chest-timer]");
  const readyLabel = document.querySelector<HTMLElement>("[data-free-chest-ready]");
  const rewardValue = document.querySelector<HTMLElement>("[data-free-chest-reward] b");
  if (!button || !timer || !readyLabel || !rewardValue) return;

  const storedReadyAt = Number(localStorage.getItem(freeChestReadyAtStorageKey));
  let readyAt = Number.isFinite(storedReadyAt) && storedReadyAt > 0 ? storedReadyAt : 0;
  let opening = false;

  const update = (): void => {
    const remainingSeconds = Math.max(0, Math.ceil((readyAt - Date.now()) / 1000));
    const ready = remainingSeconds === 0 && !opening;
    const hours = Math.floor(remainingSeconds / 3600);
    const minutes = Math.floor((remainingSeconds % 3600) / 60);
    const seconds = remainingSeconds % 60;
    const value = [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
    if (timer.textContent !== value) timer.textContent = value;
    timer.dateTime = `PT${hours}H${minutes}M${seconds}S`;
    timer.hidden = ready || opening;
    readyLabel.hidden = !ready;
    button.disabled = !ready;
    button.classList.toggle("is-ready", ready);
    const label = t(ready ? "menu.openChest" : "menu.freeChest");
    button.setAttribute("aria-label", label);
    button.title = label;
  };

  button.addEventListener("click", () => {
    if (opening || readyAt > Date.now()) return;
    opening = true;
    readyAt = Date.now() + freeChestCountdownMs;
    localStorage.setItem(freeChestReadyAtStorageKey, String(readyAt));
    rewardValue.textContent = `+${onClaim()}`;
    button.classList.remove("is-ready");
    button.classList.add("is-opening");
    update();

    window.setTimeout(() => {
      button.classList.remove("is-opening");
      opening = false;
      update();
    }, 1500);
  });

  update();
  window.setInterval(update, 1000);
}

function applyTranslations(t: Translator): void {
  for (const element of document.querySelectorAll<HTMLElement>("[data-i18n]")) {
    const key = element.dataset.i18n as TranslationKey | undefined;
    if (key) element.textContent = t(key);
  }

  for (const element of document.querySelectorAll<HTMLElement>("[data-i18n-aria]")) {
    const key = element.dataset.i18nAria as TranslationKey | undefined;
    if (!key) continue;
    const label = t(key);
    element.setAttribute("aria-label", label);
    element.title = label;
  }
}
