import { describe, expect, it, vi } from "vitest";
import {
  createYandexPlatformService,
  YandexPlatformService,
  type YaGamesGlobal,
} from "./yandexPlatform";

function createSdkMock() {
  let rewardedCallbacks: {
    onRewarded?: () => void;
    onClose?: (wasShown: boolean) => void;
    onError?: (error: object) => void;
  } | null = null;
  let fullscreenCallbacks: {
    onClose?: (wasShown: boolean) => void;
    onError?: (error: object) => void;
  } | null = null;
  const ready = vi.fn();
  const gameplayStart = vi.fn();
  const gameplayStop = vi.fn();
  const player = {
    isAuthorized: vi.fn(() => false),
    getData: vi.fn(async () => ({})),
    setData: vi.fn(async () => {}),
  };
  const payments = {
    getCatalog: vi.fn(async () => []),
    purchase: vi.fn(),
    getPurchases: vi.fn(async () => []),
    consumePurchase: vi.fn(async () => {}),
  };
  const multiplayerSessions = {
    init: vi.fn(async (): Promise<Array<{ id: string; player: { avatar: string; name: string }; timeline: Array<{ payload?: unknown }> }>> => []),
    commit: vi.fn(),
    push: vi.fn(async () => {}),
  };
  const serverTime = vi.fn(() => 1_752_729_600_000);
  const sdk = {
    environment: { i18n: { lang: "ru" } },
    features: {
      LoadingAPI: { ready },
      GameplayAPI: { start: gameplayStart, stop: gameplayStop },
    },
    adv: {
      showFullscreenAdv: vi.fn((options) => { fullscreenCallbacks = options.callbacks; }),
      showRewardedVideo: vi.fn((options) => { rewardedCallbacks = options.callbacks; }),
    },
    auth: { openAuthDialog: vi.fn(async () => {}) },
    serverTime,
    getPlayer: vi.fn(async () => player),
    getPayments: vi.fn(async () => payments),
    multiplayer: { sessions: multiplayerSessions },
  };
  const init = vi.fn(async () => sdk);
  return {
    yaGames: { init } as unknown as YaGamesGlobal,
    init,
    ready,
    gameplayStart,
    gameplayStop,
    getRewardedCallbacks: () => rewardedCallbacks,
    getFullscreenCallbacks: () => fullscreenCallbacks,
    showRewardedVideo: sdk.adv.showRewardedVideo,
    showFullscreenAdv: sdk.adv.showFullscreenAdv,
    serverTime,
    player,
    multiplayerSessions,
  };
}

describe("YandexPlatformService", () => {
  it("waits for the SDK loader before initializing", async () => {
    const mock = createSdkMock();
    let resolveSdk!: (yaGames: YaGamesGlobal) => void;
    const sdkReady = new Promise<YaGamesGlobal>((resolve) => { resolveSdk = resolve; });
    vi.stubGlobal("window", { __yandexSdkReady: sdkReady });

    try {
      const servicePromise = createYandexPlatformService();
      expect(mock.init).not.toHaveBeenCalled();
      resolveSdk(mock.yaGames);

      await expect(servicePromise).resolves.toBeInstanceOf(YandexPlatformService);
      expect(mock.init).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("initializes once and sends loading/gameplay events idempotently", async () => {
    const mock = createSdkMock();
    const service = await YandexPlatformService.initialize(mock.yaGames);

    service.markPlayable();
    service.markPlayable();
    service.setGameplayActive(true);
    service.setGameplayActive(true);
    service.setGameplayActive(false);
    service.setGameplayActive(false);

    expect(mock.init).toHaveBeenCalledTimes(1);
    expect(mock.ready).toHaveBeenCalledTimes(1);
    expect(mock.gameplayStart).toHaveBeenCalledTimes(1);
    expect(mock.gameplayStop).toHaveBeenCalledTimes(1);
  });

  it("uses the trusted SDK server time", async () => {
    const mock = createSdkMock();
    const service = await YandexPlatformService.initialize(mock.yaGames);

    expect(service.serverTime()).toBe(1_752_729_600_000);
    expect(mock.serverTime).toHaveBeenCalledTimes(1);
  });

  it("loads opponent names and records the completed asynchronous session", async () => {
    const mock = createSdkMock();
    mock.multiplayerSessions.init.mockResolvedValueOnce([
      {
        id: "session-1",
        player: { avatar: "https://example.com/avatar.png", name: "Opponent" },
        timeline: [{ payload: { type: "match-start", maxRPM: 7200, damageMultiplier: 1.16 } }],
      },
    ]);
    const service = await YandexPlatformService.initialize(mock.yaGames);

    await expect(service.startAsyncOpponentSession({ opponentCount: 1, matchMode: 1 }))
      .resolves.toEqual([{
        id: "session-1",
        name: "Opponent",
        avatarUrl: "https://example.com/avatar.png",
        maxRPM: 7200,
        damageMultiplier: 1.16,
      }]);
    service.recordAsyncOpponentEvent({ type: "match-start" });
    await service.finishAsyncOpponentSession(1);

    expect(mock.multiplayerSessions.init).toHaveBeenCalledWith({
      count: 1,
      isEventBased: false,
      meta: { meta1: { min: 1, max: 1 } },
    });
    expect(mock.multiplayerSessions.commit).toHaveBeenCalledWith({ type: "match-start" });
    expect(mock.multiplayerSessions.push).toHaveBeenCalledWith({ meta1: 1 });
  });

  it("does not send unchanged player data to the SDK", async () => {
    const mock = createSdkMock();
    mock.player.getData.mockResolvedValueOnce({ profile: { parts: 100 } });
    const service = await YandexPlatformService.initialize(mock.yaGames);

    await expect(service.loadPlayerData()).resolves.toEqual({ profile: { parts: 100 } });
    await expect(service.savePlayerData({ profile: { parts: 100 } })).resolves.toBe(true);
    expect(mock.player.setData).not.toHaveBeenCalled();

    await expect(Promise.all([
      service.savePlayerData({ profile: { parts: 200 } }),
      service.savePlayerData({ profile: { parts: 200 } }),
    ])).resolves.toEqual([true, true]);
    expect(mock.player.setData).toHaveBeenCalledTimes(1);
  });

  it("grants a rewarded bonus once and only from onRewarded", async () => {
    const mock = createSdkMock();
    const service = await YandexPlatformService.initialize(mock.yaGames);
    const pauseChanges: boolean[] = [];
    const beforeAd = vi.fn(async () => {});
    const grantReward = vi.fn(async () => {});
    service.setAdHooks({ beforeAd, setAdPaused: (paused) => pauseChanges.push(paused) });

    const result = service.showRewardedAd(grantReward);
    await vi.waitFor(() => expect(mock.showRewardedVideo).toHaveBeenCalledTimes(1));
    const callbacks = mock.getRewardedCallbacks();
    callbacks?.onRewarded?.();
    callbacks?.onRewarded?.();
    callbacks?.onClose?.(true);

    await expect(result).resolves.toBe(true);
    expect(grantReward).toHaveBeenCalledTimes(1);
    expect(beforeAd).toHaveBeenCalledTimes(1);
    expect(pauseChanges).toEqual([true, false]);
  });

  it("does not grant on close and restores the game after an ad error", async () => {
    const mock = createSdkMock();
    const service = await YandexPlatformService.initialize(mock.yaGames);
    const pauseChanges: boolean[] = [];
    const grantReward = vi.fn();
    service.setAdHooks({ beforeAd: async () => {}, setAdPaused: (paused) => pauseChanges.push(paused) });

    const rewardedResult = service.showRewardedAd(grantReward);
    await vi.waitFor(() => expect(mock.showRewardedVideo).toHaveBeenCalledTimes(1));
    mock.getRewardedCallbacks()?.onClose?.(true);
    await expect(rewardedResult).resolves.toBe(false);
    expect(grantReward).not.toHaveBeenCalled();

    const fullscreenResult = service.showInterstitialAd();
    await vi.waitFor(() => expect(mock.showFullscreenAdv).toHaveBeenCalledTimes(1));
    mock.getFullscreenCallbacks()?.onError?.({});
    await expect(fullscreenResult).resolves.toBe(false);
    expect(pauseChanges).toEqual([true, false, true, false]);
  });

  it("rejects a second ad while the first one is active", async () => {
    const mock = createSdkMock();
    const service = await YandexPlatformService.initialize(mock.yaGames);
    service.setAdHooks({ beforeAd: async () => {}, setAdPaused: () => {} });

    const first = service.showRewardedAd(() => {});
    await vi.waitFor(() => expect(mock.showRewardedVideo).toHaveBeenCalledTimes(1));
    await expect(service.showInterstitialAd()).resolves.toBe(false);
    mock.getRewardedCallbacks()?.onClose?.(false);
    await expect(first).resolves.toBe(false);
    expect(mock.showFullscreenAdv).not.toHaveBeenCalled();
  });
});
