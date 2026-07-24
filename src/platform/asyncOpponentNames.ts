import type { TranslationKey } from "../i18n";
import type { PlatformAsyncOpponent } from "./platformService";

export type OpponentName =
  | { source: "yandex"; name: string; avatarUrl?: string; maxRPM?: number; damageMultiplier?: number }
  | { source: "fallback"; key: TranslationKey };

export const fallbackOpponentNameKeys: readonly TranslationKey[] = [
  "hud.opponentLesnoyVolk",
  "hud.opponentTihiyGrom",
  "hud.opponentZloyBublik",
  "hud.opponentKotVTapkah",
  "hud.opponentDedMorozik",
  "hud.opponentBorodatiyBoss",
  "hud.opponentSuroviyGus",
  "hud.opponentNochnoyBogatyr",
  "hud.opponentChudesniyLos",
  "hud.opponentHrabriyPirozhok",
];

export function createOpponentNames(
  opponents: PlatformAsyncOpponent[],
  count: number,
  random: () => number = Math.random,
): OpponentName[] {
  const names = opponents
    .map(({ name, avatarUrl, maxRPM, damageMultiplier }) => ({ name: name.trim(), avatarUrl, maxRPM, damageMultiplier }))
    .filter(({ name }, index, all) => name.length > 0 && all.findIndex((opponent) => opponent.name === name) === index)
    .slice(0, count)
    .map(({ name, avatarUrl, maxRPM, damageMultiplier }): OpponentName => ({
      source: "yandex",
      name,
      avatarUrl,
      maxRPM,
      damageMultiplier,
    }));
  const fallbackKeys = shuffle(fallbackOpponentNameKeys, random);

  for (const key of fallbackKeys) {
    if (names.length >= count) break;
    names.push({ source: "fallback", key });
  }

  return names;
}

export function resolveOpponentName(name: OpponentName | undefined, t: (key: TranslationKey) => string): string {
  if (!name) return t("hud.bot");
  return name.source === "yandex" ? name.name : t(name.key);
}

export function resolveOpponentAvatarUrl(name: OpponentName | undefined): string | undefined {
  return name?.source === "yandex" ? name.avatarUrl : undefined;
}

export function resolveOpponentStats(name: OpponentName | undefined): Pick<PlatformAsyncOpponent, "maxRPM" | "damageMultiplier"> {
  if (name?.source !== "yandex") return {};
  return { maxRPM: name.maxRPM, damageMultiplier: name.damageMultiplier };
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const nextIndex = Math.floor(random() * (index + 1));
    [result[index], result[nextIndex]] = [result[nextIndex], result[index]];
  }
  return result;
}
