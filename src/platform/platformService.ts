export type PlatformProduct = {
  id: string;
  title: string;
  price: string;
  currencyIconUrl?: string;
};

export type PlatformPurchase = {
  productId: string;
  purchaseToken: string;
};

export type PlatformAsyncOpponent = {
  id: string;
  name: string;
  avatarUrl?: string;
  maxRPM?: number;
  damageMultiplier?: number;
};

export type PlatformAsyncMatch = {
  opponentCount: number;
  matchMode: number;
};

export type PlatformAdHooks = {
  beforeAd: () => Promise<void>;
  setAdPaused: (paused: boolean) => void;
};

export interface PlatformService {
  readonly isAvailable: boolean;
  readonly language: string;
  isAuthorized(): boolean;
  authorize(): Promise<boolean>;
  markPlayable(): void;
  setGameplayActive(active: boolean): void;
  setAdHooks(hooks: PlatformAdHooks): void;
  serverTime(): number;
  loadPlayerData(): Promise<Record<string, unknown> | null>;
  savePlayerData(data: Record<string, unknown>, flush?: boolean): Promise<boolean>;
  showRewardedAd(grantReward: () => void | Promise<void>): Promise<boolean>;
  showInterstitialAd(): Promise<boolean>;
  getCatalog(): Promise<PlatformProduct[]>;
  purchase(productId: string): Promise<PlatformPurchase | null>;
  getPurchases(): Promise<PlatformPurchase[]>;
  consumePurchase(token: string): Promise<void>;
  startAsyncOpponentSession(match: PlatformAsyncMatch): Promise<PlatformAsyncOpponent[]>;
  recordAsyncOpponentEvent(payload: Record<string, unknown>): void;
  finishAsyncOpponentSession(matchMode: number): Promise<void>;
}
