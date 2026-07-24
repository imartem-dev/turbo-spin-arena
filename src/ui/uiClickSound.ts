import type { AudioManager } from "../audio/audioManager";

export function enableUiClickSound(audioManager: AudioManager): void {

  document.addEventListener("click", (event) => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>("button");
    if (!button || button.disabled || document.body.classList.contains("sound-muted")) return;

    audioManager.playUiClick();
  }, { capture: true });

  document.addEventListener("pointerover", (event) => {
    if (event.pointerType !== "mouse") return;
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>("button");
    const previousButton = (event.relatedTarget as Element | null)?.closest<HTMLButtonElement>("button");
    if (!button || button === previousButton || button.disabled || document.body.classList.contains("sound-muted")) return;

    audioManager.playUiHover();
  }, { capture: true });
}
