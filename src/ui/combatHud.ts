import type { TranslationKey } from "../i18n";
import type { GameMode } from "../progression/matchProgression";

export type RpmHudElements = {
  root: HTMLElement;
  fill: HTMLElement;
  cap: HTMLElement;
  value: HTMLElement;
  bonusIcons?: HTMLElement;
};

export type AbilityHudElements = {
  root: HTMLElement;
  fill: HTMLElement;
  value: HTMLElement;
};

export type CombatHudElements = {
  rpm: RpmHudElements[];
  dash: AbilityHudElements | null;
  ultimate: AbilityHudElements | null;
};

type HudParticipant = { name: string; avatarUrl?: string; currentRPM: number; maxRPM: number };
type Translate = (key: TranslationKey) => string;

export function createCombatHud(
  player: HudParticipant,
  enemies: HudParticipant[],
  mode: GameMode,
  t: Translate,
): CombatHudElements {
  const rpm: RpmHudElements[] = [];
  const playerRoot = document.querySelector<HTMLElement>("[data-player-rpm]");
  const enemyRoot = document.querySelector<HTMLElement>("[data-enemy-rpms]");
  let dash: AbilityHudElements | null = null;
  let ultimate: AbilityHudElements | null = null;

  if (playerRoot) {
    playerRoot.replaceChildren();
    rpm.push(createRpmCard(playerRoot, player, "player", true, t("hud.health")));
    dash = createAbilityHud(playerRoot, "dash", t("hud.dash"), t("hud.ready").toUpperCase());
    ultimate = createAbilityHud(playerRoot, "ultimate", t("hud.ultimate"), "0%");
  }

  if (enemyRoot) {
    enemyRoot.replaceChildren();
    if (mode === "duel" && enemies[0]) rpm.push(createRpmCard(enemyRoot, enemies[0], "enemy", false, t("hud.health")));
  }

  return { rpm, dash, ultimate };
}

export function formatAliveCounter(alive: number, total: number): string {
  return `${Math.max(0, alive)}/${Math.max(0, total)}`;
}

function createRpmCard(
  root: HTMLElement,
  participant: HudParticipant,
  variant: "player" | "enemy",
  includeBonuses: boolean,
  healthUnit: string,
): RpmHudElements {
  const card = document.createElement("div");
  card.className = `rpm-card ${variant}`;
  const label = document.createElement("div");
  label.className = "rpm-label";
  const identity = document.createElement("div");
  identity.className = "rpm-identity";
  if (variant === "enemy") identity.append(createOpponentAvatar(participant.avatarUrl));
  identity.append(Object.assign(document.createElement("span"), { textContent: participant.name }));
  label.append(
    identity,
    Object.assign(document.createElement("span"), { textContent: `${Math.ceil(participant.currentRPM)} / ${Math.ceil(participant.maxRPM)} ${healthUnit}` }),
  );
  const value = label.lastElementChild as HTMLElement;
  const track = document.createElement("div");
  track.className = "rpm-track";
  const cap = document.createElement("div");
  cap.className = "rpm-cap";
  const fill = document.createElement("div");
  fill.className = "rpm-fill";
  track.append(cap, fill);
  let bonusIcons: HTMLElement | undefined;
  if (includeBonuses) {
    bonusIcons = document.createElement("div");
    bonusIcons.className = "bonus-icons";
    bonusIcons.hidden = true;
    card.append(bonusIcons);
  }
  card.append(label, track);
  root.append(card);
  return { root: card, fill, cap, value, bonusIcons };
}

function createOpponentAvatar(avatarUrl: string | undefined): HTMLElement {
  const avatar = document.createElement("span");
  avatar.className = "opponent-avatar";
  if (!avatarUrl) return avatar;

  const image = document.createElement("img");
  image.src = avatarUrl;
  image.alt = "";
  image.referrerPolicy = "no-referrer";
  image.addEventListener("error", () => {
    image.remove();
    avatar.classList.add("fallback");
  }, { once: true });
  avatar.append(image);
  return avatar;
}

function createAbilityHud(
  root: HTMLElement,
  className: "dash" | "ultimate",
  nameText: string,
  valueText: string,
): AbilityHudElements {
  const card = document.createElement("div");
  card.className = `${className}-card ability-card`;
  const label = document.createElement("div");
  label.className = `${className}-label ability-label`;
  label.append(
    Object.assign(document.createElement("span"), { textContent: nameText }),
    Object.assign(document.createElement("span"), { textContent: valueText }),
  );
  const value = label.lastElementChild as HTMLElement;
  const track = document.createElement("div");
  track.className = `${className}-track ability-track`;
  const fill = document.createElement("div");
  fill.className = `${className}-fill ability-fill`;
  track.append(fill);
  card.append(label, track);
  root.append(card);
  return { root: card, fill, value };
}
