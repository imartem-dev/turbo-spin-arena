import type {
  PlatformAdHooks,
  PlatformAsyncMatch,
  PlatformAsyncOpponent,
  PlatformProduct,
  PlatformPurchase,
  PlatformService,
} from "./platformService";

type YandexPlayer = {
  isAuthorized(): boolean;
  getData(keys?: string[]): Promise<Record<string, unknown>>;
  setData(data: Record<string, unknown>, flush?: boolean): Promise<void>;
};

type YandexPurchase = {
  productID: string;
  purchaseToken: string;
};

type YandexProduct = {
  id: string;
  title: string;
  price: string;
  getPriceCurrencyImage(size: "small" | "medium" | "svg"): string;
};

type YandexPayments = {
  getCatalog(): Promise<YandexProduct[]>;
  purchase(data: { id: string }): Promise<YandexPurchase>;
  getPurchases(): Promise<YandexPurchase[]>;
  consumePurchase(token: string): Promise<void>;
};

type YandexAsyncOpponent = {
  id: string;
  player: { avatar: string; name: string };
  timeline: Array<{ payload?: unknown }>;
};

type YandexMultiplayerSessions = {
  init(options: {
    count: number;
    isEventBased: false;
    meta: { meta1: { min: number; max: number } };
  }): Promise<YandexAsyncOpponent[]>;
  commit(payload: Record<string, unknown>): void;
  push(meta: { meta1: number }): Promise<void>;
};

type YandexSdk = {
  environment: { i18n: { lang: string } };
  features: {
    LoadingAPI?: { ready(): void };
    GameplayAPI?: { start(): void; stop(): void };
  };
  adv: {
    showFullscreenAdv(options: {
      callbacks: {
        onOpen?: () => void;
        onClose?: (wasShown: boolean) => void;
        onError?: (error: object) => void;
      };
    }): void;
    showRewardedVideo(options: {
      callbacks: {
        onOpen?: () => void;
        onRewarded?: () => void;
        onClose?: (wasShown: boolean) => void;
        onError?: (error: object) => void;
      };
    }): void;
  };
  auth: { openAuthDialog(): Promise<void> };
  serverTime(): number;
  getPlayer(): Promise<YandexPlayer>;
  getPayments(): Promise<YandexPayments>;
  multiplayer?: { sessions: YandexMultiplayerSessions };
};

export type YaGamesGlobal = {
  init(): Promise<YandexSdk>;
};

declare global {
  interface Window {
    YaGames?: YaGamesGlobal;
    __yandexSdkReady?: Promise<YaGamesGlobal | undefined>;
  }
}

export class YandexPlatformService implements PlatformService {
  readonly isAvailable = true;
  readonly language: string;
  private player: YandexPlayer | null = null;
  private paymentsPromise: Promise<YandexPayments> | null = null;
  private adHooks: PlatformAdHooks | null = null;
  private playableMarked = false;
  private gameplayActive = false;
  private adInFlight = false;
  private lastPlayerDataFingerprint: string | null = null;
  private playerDataSaveChain: Promise<boolean> = Promise.resolve(true);
  private asyncSessionActive = false;

  private constructor(private readonly sdk: YandexSdk) {
    this.language = sdk.environment.i18n.lang;
  }

  static async initialize(yaGames: YaGamesGlobal): Promise<YandexPlatformService> {
    const service = new YandexPlatformService(await yaGames.init());
    await service.refreshPlayer();
    return service;
  }

  isAuthorized(): boolean {
    return this.player?.isAuthorized() === true;
  }

  async authorize(): Promise<boolean> {
    if (this.isAuthorized()) return true;
    try {
      await this.sdk.auth.openAuthDialog();
      await this.refreshPlayer();
      return this.isAuthorized();
    } catch {
      return false;
    }
  }

  markPlayable(): void {
    if (this.playableMarked) return;
    this.playableMarked = true;
    this.sdk.features.LoadingAPI?.ready();
  }

  setGameplayActive(active: boolean): void {
    if (this.gameplayActive === active) return;
    this.gameplayActive = active;
    if (active) this.sdk.features.GameplayAPI?.start();
    else this.sdk.features.GameplayAPI?.stop();
  }

  setAdHooks(hooks: PlatformAdHooks): void {
    this.adHooks = hooks;
  }

  serverTime(): number {
    return this.sdk.serverTime();
  }

  async loadPlayerData(): Promise<Record<string, unknown> | null> {
    const player = await this.ensurePlayer();
    if (!player) return null;
    try {
      const data = await player.getData();
      this.lastPlayerDataFingerprint = JSON.stringify(data);
      return data;
    } catch {
      return null;
    }
  }

  savePlayerData(data: Record<string, unknown>, flush = true): Promise<boolean> {
    let fingerprint: string;
    try {
      fingerprint = JSON.stringify(data);
    } catch {
      return Promise.resolve(false);
    }

    const save = async (): Promise<boolean> => {
      if (fingerprint === this.lastPlayerDataFingerprint) return true;
      const player = await this.ensurePlayer();
      if (!player) return false;
      try {
        await player.setData(JSON.parse(fingerprint) as Record<string, unknown>, flush);
        this.lastPlayerDataFingerprint = fingerprint;
        return true;
      } catch {
        return false;
      }
    };

    this.playerDataSaveChain = this.playerDataSaveChain.then(save, save);
    return this.playerDataSaveChain;
  }

  async showRewardedAd(grantReward: () => void | Promise<void>): Promise<boolean> {
    if (!await this.beginAd()) return false;

    return new Promise<boolean>((resolve) => {
      let rewarded = false;
      let rewardSucceeded = false;
      let rewardTask = Promise.resolve();
      let finishing = false;

      const finish = (): void => {
        if (finishing) return;
        finishing = true;
        void rewardTask.finally(() => {
          this.endAd();
          resolve(rewarded && rewardSucceeded);
        });
      };

      try {
        this.sdk.adv.showRewardedVideo({
          callbacks: {
            onRewarded: () => {
              if (rewarded) return;
              rewarded = true;
              rewardTask = Promise.resolve(grantReward())
                .then(() => { rewardSucceeded = true; })
                .catch(() => { rewardSucceeded = false; });
            },
            onClose: finish,
            onError: finish,
          },
        });
      } catch {
        finish();
      }
    });
  }

  async showInterstitialAd(): Promise<boolean> {
    if (!await this.beginAd()) return false;

    return new Promise<boolean>((resolve) => {
      let finishing = false;
      const finish = (wasShown: boolean): void => {
        if (finishing) return;
        finishing = true;
        this.endAd();
        resolve(wasShown);
      };

      try {
        this.sdk.adv.showFullscreenAdv({
          callbacks: {
            onClose: finish,
            onError: () => finish(false),
          },
        });
      } catch {
        finish(false);
      }
    });
  }

  async getCatalog(): Promise<PlatformProduct[]> {
    const payments = await this.getPayments();
    if (!payments) return [];
    try {
      return (await payments.getCatalog()).map((product) => ({
        id: product.id,
        title: product.title,
        price: product.price,
        currencyIconUrl: getCurrencyIcon(product),
      }));
    } catch {
      return [];
    }
  }

  async purchase(productId: string): Promise<PlatformPurchase | null> {
    if (this.adInFlight) return null;
    const payments = await this.getPayments();
    if (!payments) return null;
    try {
      return mapPurchase(await payments.purchase({ id: productId }));
    } catch {
      return null;
    }
  }

  async getPurchases(): Promise<PlatformPurchase[]> {
    const payments = await this.getPayments();
    if (!payments) return [];
    try {
      return (await payments.getPurchases()).map(mapPurchase);
    } catch {
      return [];
    }
  }

  async consumePurchase(token: string): Promise<void> {
    const payments = await this.getPayments();
    if (!payments) return;
    await payments.consumePurchase(token);
  }

  async startAsyncOpponentSession(match: PlatformAsyncMatch): Promise<PlatformAsyncOpponent[]> {
    this.asyncSessionActive = false;
    const sessions = this.sdk.multiplayer?.sessions;
    if (!sessions) return [];

    try {
      const opponents = await sessions.init({
        count: Math.min(10, Math.max(1, Math.round(match.opponentCount))),
        isEventBased: false,
        meta: { meta1: { min: match.matchMode, max: match.matchMode } },
      });
      this.asyncSessionActive = true;
      return opponents.map(({ id, player, timeline }) => ({
        id,
        name: player.name,
        avatarUrl: player.avatar.trim() || undefined,
        ...readOpponentStats(timeline),
      }));
    } catch {
      return [];
    }
  }

  recordAsyncOpponentEvent(payload: Record<string, unknown>): void {
    if (!this.asyncSessionActive) return;
    try {
      this.sdk.multiplayer?.sessions.commit(payload);
    } catch {
      // A missing multiplayer service must not interrupt a match.
    }
  }

  async finishAsyncOpponentSession(matchMode: number): Promise<void> {
    if (!this.asyncSessionActive) return;
    this.asyncSessionActive = false;
    try {
      await this.sdk.multiplayer?.sessions.push({ meta1: matchMode });
    } catch {
      // A later player can still receive previously saved sessions.
    }
  }

  private async beginAd(): Promise<boolean> {
    if (this.adInFlight) return false;
    this.adInFlight = true;
    try {
      await this.adHooks?.beforeAd();
    } catch {
      // Local progress has already been saved; an unavailable cloud must not block the game.
    }
    this.adHooks?.setAdPaused(true);
    return true;
  }

  private endAd(): void {
    if (!this.adInFlight) return;
    this.adInFlight = false;
    this.adHooks?.setAdPaused(false);
  }

  private async refreshPlayer(): Promise<void> {
    try {
      this.player = await this.sdk.getPlayer();
    } catch {
      this.player = null;
    }
  }

  private async ensurePlayer(): Promise<YandexPlayer | null> {
    if (!this.player) await this.refreshPlayer();
    return this.player;
  }

  private async getPayments(): Promise<YandexPayments | null> {
    if (!this.paymentsPromise) {
      this.paymentsPromise = this.sdk.getPayments();
    }
    try {
      return await this.paymentsPromise;
    } catch {
      this.paymentsPromise = null;
      return null;
    }
  }
}

export async function createYandexPlatformService(): Promise<YandexPlatformService> {
  const yaGames = window.__yandexSdkReady
    ? await window.__yandexSdkReady
    : window.YaGames;
  if (!yaGames) throw new Error("Yandex Games SDK is unavailable.");
  return YandexPlatformService.initialize(yaGames);
}

function mapPurchase(purchase: YandexPurchase): PlatformPurchase {
  return { productId: purchase.productID, purchaseToken: purchase.purchaseToken };
}

function getCurrencyIcon(product: YandexProduct): string | undefined {
  try {
    return product.getPriceCurrencyImage("small");
  } catch {
    return undefined;
  }
}

function readOpponentStats(timeline: Array<{ payload?: unknown }>): Pick<PlatformAsyncOpponent, "maxRPM" | "damageMultiplier"> {
  const profile = timeline.find(({ payload }) => isMatchStartPayload(payload))?.payload;
  if (!profile || typeof profile !== "object") return {};

  const { maxRPM, damageMultiplier } = profile as Record<string, unknown>;
  return {
    maxRPM: readPositiveNumber(maxRPM),
    damageMultiplier: readPositiveNumber(damageMultiplier),
  };
}

function isMatchStartPayload(payload: unknown): payload is { type: "match-start" } {
  return typeof payload === "object" && payload !== null && (payload as Record<string, unknown>).type === "match-start";
}

function readPositiveNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}
