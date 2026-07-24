import { describe, expect, it, vi } from "vitest";
import { AdManager, interstitialCooldownMs } from "./adManager";
import type { PlatformService } from "./platformService";

function createPlatform() {
  const platform = {
    isAvailable: true,
    language: "ru",
    isAuthorized: () => false,
    authorize: async () => false,
    markPlayable: () => {},
    setGameplayActive: () => {},
    setAdHooks: () => {},
    serverTime: () => 0,
    loadPlayerData: async () => null,
    savePlayerData: async () => true,
    showRewardedAd: vi.fn(async () => false),
    showInterstitialAd: vi.fn(async () => false),
    getCatalog: async () => [],
    purchase: async () => null,
    getPurchases: async () => [],
    consumePurchase: async () => {},
    startAsyncOpponentSession: async () => [],
    recordAsyncOpponentEvent: () => {},
    finishAsyncOpponentSession: async () => {},
  } satisfies PlatformService;
  return platform;
}

describe("AdManager", () => {
  it("continues the transition after an unavailable or failed interstitial", async () => {
    const platform = createPlatform();
    platform.showInterstitialAd.mockResolvedValue(false);
    const manager = new AdManager(platform);
    const action = vi.fn();

    await expect(manager.runTransition(action, true)).resolves.toBe(true);
    expect(platform.showInterstitialAd).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("continues the transition when the SDK rejects the ad request", async () => {
    const platform = createPlatform();
    platform.showInterstitialAd.mockRejectedValue(new Error("SDK unavailable"));
    const manager = new AdManager(platform);
    const action = vi.fn();

    await expect(manager.runTransition(action, true)).resolves.toBe(true);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("waits one minute after a successful interstitial without auto-showing", async () => {
    const platform = createPlatform();
    platform.showInterstitialAd.mockResolvedValue(true);
    let now = 1_000;
    const manager = new AdManager(platform, () => now);
    const action = vi.fn();

    await manager.runTransition(action, true);
    now += interstitialCooldownMs - 1;
    await manager.runTransition(action, true);
    now += 1;
    await manager.runTransition(action, true);

    expect(platform.showInterstitialAd).toHaveBeenCalledTimes(2);
    expect(action).toHaveBeenCalledTimes(3);
  });

  it("does not start an interstitial while a rewarded ad is active", async () => {
    const platform = createPlatform();
    let finishReward!: (shown: boolean) => void;
    platform.showRewardedAd.mockImplementation(() => new Promise<boolean>((resolve) => { finishReward = resolve; }));
    const manager = new AdManager(platform);
    const reward = manager.showRewardedAd(() => {});
    const action = vi.fn();

    await expect(manager.runTransition(action, true)).resolves.toBe(false);
    expect(platform.showInterstitialAd).not.toHaveBeenCalled();
    expect(action).not.toHaveBeenCalled();
    finishReward(false);
    await reward;
  });

  it("rejects a rapid second transition request", async () => {
    const platform = createPlatform();
    let finishAd!: (shown: boolean) => void;
    platform.showInterstitialAd.mockImplementation(() => new Promise<boolean>((resolve) => { finishAd = resolve; }));
    const manager = new AdManager(platform);
    const firstAction = vi.fn();
    const secondAction = vi.fn();
    const first = manager.runTransition(firstAction, true);

    await expect(manager.runTransition(secondAction, true)).resolves.toBe(false);
    finishAd(true);
    await first;
    expect(firstAction).toHaveBeenCalledTimes(1);
    expect(secondAction).not.toHaveBeenCalled();
  });
});
