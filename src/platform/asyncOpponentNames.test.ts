import { describe, expect, it } from "vitest";
import { createOpponentNames, resolveOpponentAvatarUrl, resolveOpponentName, resolveOpponentStats } from "./asyncOpponentNames";

describe("async opponent names", () => {
  it("uses Yandex names first and fills the rest from the fallback buffer", () => {
    const names = createOpponentNames([
      { id: "one", name: "  RealPlayer  " },
      { id: "two", name: "RealPlayer" },
      { id: "three", name: "" },
    ], 3, () => 0);

    expect(names).toEqual([
      { source: "yandex", name: "RealPlayer" },
      { source: "fallback", key: "hud.opponentTihiyGrom" },
      { source: "fallback", key: "hud.opponentZloyBublik" },
    ]);
  });

  it("resolves fallback names through i18n", () => {
    expect(resolveOpponentName({ source: "fallback", key: "hud.opponentLesnoyVolk" }, (key) => key)).toBe("hud.opponentLesnoyVolk");
  });

  it("keeps the Yandex profile paired with its opponent name", () => {
    const [opponent] = createOpponentNames([{
      id: "one",
      name: "RealPlayer",
      avatarUrl: "https://example.com/avatar.png",
      maxRPM: 7200,
      damageMultiplier: 1.16,
    }], 1);

    expect(resolveOpponentAvatarUrl(opponent)).toBe("https://example.com/avatar.png");
    expect(resolveOpponentStats(opponent)).toEqual({ maxRPM: 7200, damageMultiplier: 1.16 });
  });
});
