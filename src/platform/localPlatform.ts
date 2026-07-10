export type PlatformProduct = { id: string; title: string; price: string; currencyIconUrl?: string };
export type PlatformPurchase = { productId: string; purchaseToken: string };

export interface PlatformService {
  showRewardedAd(): Promise<boolean>;
  showInterstitialAd(): Promise<boolean>;
  getCatalog(): Promise<PlatformProduct[]>;
  purchase(productId: string): Promise<PlatformPurchase | null>;
  getPurchases(): Promise<PlatformPurchase[]>;
  consumePurchase(token: string): Promise<void>;
}

export const localPlatform: PlatformService = {
  async showRewardedAd() { return true; },
  async showInterstitialAd() { return false; },
  async getCatalog() { return []; },
  async purchase() { return null; },
  async getPurchases() { return []; },
  async consumePurchase() {},
};
