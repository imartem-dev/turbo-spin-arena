import type { PlatformService } from "./platformService";

export const interstitialCooldownMs = 1 * 60 * 1_000;

/** Serializes all ad requests and applies the game-level interstitial policy. */
export class AdManager {
  private adInFlight = false;
  private lastSuccessfulInterstitialAt = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly platform: PlatformService,
    private readonly now: () => number = () => platform.serverTime(),
  ) {}

  async showRewardedAd(grantReward: () => void | Promise<void>): Promise<boolean> {
    if (this.adInFlight) return false;
    this.adInFlight = true;
    try {
      return await this.platform.showRewardedAd(grantReward);
    } finally {
      this.adInFlight = false;
    }
  }

  async runTransition(action: () => void | Promise<void>, allowInterstitial: boolean): Promise<boolean> {
    if (this.adInFlight) return false;
    this.adInFlight = true;
    try {
      if (allowInterstitial && this.isInterstitialDue()) {
        try {
          const wasShown = await this.platform.showInterstitialAd();
          if (wasShown) this.lastSuccessfulInterstitialAt = this.now();
        } catch {
          // SDK failures must not prevent the user-requested navigation.
        }
      }
      await action();
      return true;
    } finally {
      this.adInFlight = false;
    }
  }

  private isInterstitialDue(): boolean {
    return this.now() - this.lastSuccessfulInterstitialAt >= interstitialCooldownMs;
  }
}
