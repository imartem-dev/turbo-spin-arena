export type RuntimePauseReason = "ad" | "blur" | "visibility";

type RuntimeLifecycleOptions = {
  onPauseChanged: (paused: boolean) => void;
  onResume: () => void;
};

export class GameRuntimeLifecycle {
  private readonly pauseReasons = new Set<RuntimePauseReason>();
  private readonly mediaToResume = new Set<HTMLMediaElement>();
  private attached = false;

  constructor(private readonly options: RuntimeLifecycleOptions) {}

  get paused(): boolean {
    return this.pauseReasons.size > 0;
  }

  attach(): void {
    if (this.attached) return;
    this.attached = true;
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    window.addEventListener("blur", this.handleBlur);
    window.addEventListener("focus", this.handleFocus);
    window.addEventListener("pagehide", this.handlePageHide);
    window.addEventListener("pageshow", this.handlePageShow);
    this.setPaused("visibility", document.hidden);
    this.setPaused("blur", typeof document.hasFocus === "function" && !document.hasFocus());
  }

  setPaused(reason: RuntimePauseReason, paused: boolean): void {
    const wasPaused = this.paused;
    if (paused) this.pauseReasons.add(reason);
    else this.pauseReasons.delete(reason);
    if (wasPaused === this.paused) return;

    this.syncMedia(this.paused);
    if (!this.paused) this.options.onResume();
    this.options.onPauseChanged(this.paused);
  }

  private readonly handleVisibilityChange = (): void => {
    this.setPaused("visibility", document.hidden);
  };

  private readonly handleBlur = (): void => {
    this.setPaused("blur", true);
  };

  private readonly handleFocus = (): void => {
    this.setPaused("blur", false);
    this.setPaused("visibility", document.hidden);
  };

  private readonly handlePageHide = (): void => {
    this.setPaused("visibility", true);
  };

  private readonly handlePageShow = (): void => {
    this.setPaused("visibility", document.hidden);
  };

  private syncMedia(paused: boolean): void {
    if (paused) {
      for (const media of document.querySelectorAll<HTMLMediaElement>("audio, video")) {
        if (media.paused) continue;
        this.mediaToResume.add(media);
        media.pause();
      }
      return;
    }

    if (document.body.classList.contains("sound-muted")) {
      this.mediaToResume.clear();
      return;
    }
    for (const media of this.mediaToResume) {
      void media.play().catch(() => {});
    }
    this.mediaToResume.clear();
  }
}
