import type {
  PlatformAdHooks,
  PlatformAsyncMatch,
  PlatformAsyncOpponent,
  PlatformProduct,
  PlatformPurchase,
  PlatformService,
} from "./platformService";

export class LocalPlatformService implements PlatformService {
  readonly isAvailable = false;
  readonly language: string;
  private adHooks: PlatformAdHooks | null = null;

  constructor(language = navigator.language) {
    this.language = language;
  }

  isAuthorized(): boolean { return false; }
  async authorize(): Promise<boolean> { return false; }
  markPlayable(): void {}
  setGameplayActive(_active: boolean): void {}
  setAdHooks(hooks: PlatformAdHooks): void { this.adHooks = hooks; }
  serverTime(): number { return Date.now(); }
  async loadPlayerData(): Promise<Record<string, unknown> | null> { return null; }
  async savePlayerData(_data: Record<string, unknown>, _flush = true): Promise<boolean> { return true; }

  async showRewardedAd(grantReward: () => void | Promise<void>): Promise<boolean> {
    await this.adHooks?.beforeAd();
    this.adHooks?.setAdPaused(true);
    try {
      await grantReward();
      return true;
    } finally {
      this.adHooks?.setAdPaused(false);
    }
  }

  async showInterstitialAd(): Promise<boolean> { return false; }
  async getCatalog(): Promise<PlatformProduct[]> { return []; }
  async purchase(_productId: string): Promise<PlatformPurchase | null> { return null; }
  async getPurchases(): Promise<PlatformPurchase[]> { return []; }
  async consumePurchase(_token: string): Promise<void> {}
  async startAsyncOpponentSession(_match: PlatformAsyncMatch): Promise<PlatformAsyncOpponent[]> { return []; }
  recordAsyncOpponentEvent(_payload: Record<string, unknown>): void {}
  async finishAsyncOpponentSession(_matchMode: number): Promise<void> {}
}
