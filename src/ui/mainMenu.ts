import type { LanguageCode, TranslationKey } from "../i18n";
import type { GameMode } from "../progression/matchProgression";

type Translator = (key: TranslationKey) => string;

type MainMenuOptions = {
  initialMode: GameMode;
  devMode: boolean;
  t: Translator;
  language: LanguageCode;
  languages: ReadonlyArray<{ code: LanguageCode; name: string }>;
  onModeSelected: (mode: GameMode) => void;
  onLanguageSelected: (language: LanguageCode) => void;
  onSoundChanged: (enabled: boolean) => void;
};

const soundStorageKey = "turbo-spin-arena:menu-sound";

export function setupMainMenu(options: MainMenuOptions): void {
  const menu = document.querySelector<HTMLElement>("[data-start-menu]");
  const startButton = document.querySelector<HTMLButtonElement>("[data-start-match]");
  if (!menu || !startButton) {
    throw new Error("Start menu controls are missing.");
  }

  configureDevelopmentControls(options.devMode);
  applyTranslations(options.t);
  bindModeSelection(options.initialMode, options.onModeSelected);
  bindSoundControl(options.t, options.onSoundChanged);
  bindLanguageControl(options);
}

export function refreshMainMenuTranslations(t: Translator): void {
  applyTranslations(t);
  const soundButton = document.querySelector<HTMLButtonElement>("[data-menu-sound]");
  if (!soundButton) return;
  const key = soundButton.classList.contains("sound-off") ? "menu.soundOff" : "menu.sound";
  const label = t(key);
  soundButton.setAttribute("aria-label", label);
  soundButton.title = label;
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

function bindSoundControl(t: Translator, onSoundChanged: (enabled: boolean) => void): void {
  const button = document.querySelector<HTMLButtonElement>("[data-menu-sound]");
  if (!button) return;

  let soundEnabled = localStorage.getItem(soundStorageKey) !== "off";

  const render = (): void => {
    button.classList.toggle("sound-off", !soundEnabled);
    button.setAttribute("aria-pressed", String(soundEnabled));
    button.setAttribute("aria-label", t(soundEnabled ? "menu.sound" : "menu.soundOff"));
    button.title = button.getAttribute("aria-label") ?? "";
    document.body.classList.toggle("sound-muted", !soundEnabled);
    onSoundChanged(soundEnabled);
    if (!soundEnabled) {
      for (const media of document.querySelectorAll<HTMLMediaElement>("audio, video")) media.pause();
    }
  };

  button.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    localStorage.setItem(soundStorageKey, soundEnabled ? "on" : "off");
    render();
  });

  render();
}

function bindLanguageControl(options: MainMenuOptions): void {
  const button = document.querySelector<HTMLButtonElement>("[data-menu-language]");
  const menu = document.querySelector<HTMLElement>("[data-language-menu]");
  const dialog = document.querySelector<HTMLElement>("[data-language-dialog]");
  const closeButton = document.querySelector<HTMLButtonElement>("[data-language-close]");
  const label = document.querySelector<HTMLElement>("[data-language-code]");
  if (!button || !menu || !dialog || !closeButton || !label) return;

  const close = (): void => {
    dialog.hidden = true;
    button.setAttribute("aria-expanded", "false");
  };
  const open = (): void => {
    dialog.hidden = false;
    button.setAttribute("aria-expanded", "true");
  };
  const render = (activeLanguage: LanguageCode): void => {
    label.textContent = activeLanguage.toUpperCase();
    menu.replaceChildren(...options.languages.map(({ code, name }) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "language-menu-item";
      item.textContent = name;
      item.dataset.language = code;
      item.setAttribute("role", "menuitemradio");
      item.setAttribute("aria-checked", String(code === activeLanguage));
      item.classList.toggle("active", code === activeLanguage);
      item.addEventListener("click", () => {
        if (code !== activeLanguage) options.onLanguageSelected(code);
        close();
      });
      return item;
    }));
  };

  render(options.language);
  button.addEventListener("click", () => dialog.hidden ? open() : close());
  closeButton.addEventListener("click", close);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });

  document.addEventListener("turbo-spin-arena:language-changed", ((event: CustomEvent<LanguageCode>) => {
    render(event.detail);
  }) as EventListener);
}

function configureDevelopmentControls(_devMode: boolean): void {
  const controls = document.querySelector<HTMLElement>("[data-dev-controls]");
  controls?.remove();
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
