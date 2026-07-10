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

type HudParticipant = { name: string; currentRPM: number; maxRPM: number };
type Translate = (key: TranslationKey) => string;

export type LeaderboardViewRow = {
  id: string;
  rank: number;
  name: string;
  kills: number;
  deaths: number;
  criticalHits: number;
  rating: number;
  player: boolean;
  respawning: boolean;
  invulnerable: boolean;
};

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
    rpm.push(createRpmCard(playerRoot, player, "player", true));
    dash = createAbilityHud(playerRoot, "dash", t("hud.dash"), t("hud.ready").toUpperCase());
    ultimate = createAbilityHud(playerRoot, "ultimate", t("hud.ultimate"), "0%");
  }

  if (enemyRoot) {
    enemyRoot.replaceChildren();
    if (mode === "duel" && enemies[0]) rpm.push(createRpmCard(enemyRoot, enemies[0], "enemy", false));
  }

  return { rpm, dash, ultimate };
}

export function renderCompactLeaderboard(
  root: HTMLElement | null,
  rows: LeaderboardViewRow[],
  t: Translate,
): void {
  if (!root) return;
  const uniqueRows = selectCompactLeaderboardRows(rows);
  const playerRow = rows.find((row) => row.player);
  const place = document.createElement("div");
  place.className = "compact-place";
  place.textContent = playerRow ? `${t("hud.place")} #${playerRow.rank}` : t("hud.leaderboard");
  const list = document.createElement("ol");
  list.className = "compact-leaderboard-list";
  for (const row of uniqueRows) {
    const item = document.createElement("li");
    item.className = row.player ? "player" : "";
    item.append(
      Object.assign(document.createElement("span"), { textContent: `#${row.rank}` }),
      Object.assign(document.createElement("strong"), { textContent: row.name }),
      Object.assign(document.createElement("span"), { textContent: String(row.rating) }),
    );
    list.append(item);
  }
  root.replaceChildren(place, list);
}

export function selectCompactLeaderboardRows(rows: LeaderboardViewRow[]): LeaderboardViewRow[] {
  return rows
    .filter((row, index) => index < 3 || row.player)
    .filter((row, index, all) => all.findIndex((candidate) => candidate.id === row.id) === index);
}

export function renderFullLeaderboard(
  root: HTMLElement | null,
  rows: LeaderboardViewRow[],
  t: Translate,
): void {
  if (!root) return;
  const title = document.createElement("div");
  title.className = "deathmatch-leaderboard-title";
  title.textContent = t("mode.deathmatch");
  const table = document.createElement("table");
  table.className = "deathmatch-leaderboard-table";
  const header = document.createElement("thead");
  const headerRow = document.createElement("tr");
  for (const label of ["#", t("hud.name"), t("hud.killsShort"), t("hud.deathsShort"), t("hud.critShort"), t("hud.rating")]) {
    const cell = document.createElement("th");
    cell.textContent = label;
    headerRow.append(cell);
  }
  header.append(headerRow);
  const body = document.createElement("tbody");
  for (const row of rows) {
    const tr = document.createElement("tr");
    tr.classList.toggle("player", row.player);
    tr.classList.toggle("respawning", row.respawning);
    tr.classList.toggle("invulnerable", row.invulnerable);
    for (const value of [row.rank, row.name, row.kills, row.deaths, row.criticalHits, row.rating]) {
      const cell = document.createElement("td");
      cell.textContent = String(value);
      tr.append(cell);
    }
    body.append(tr);
  }
  table.append(header, body);
  root.replaceChildren(title, table);
}

function createRpmCard(
  root: HTMLElement,
  participant: HudParticipant,
  variant: "player" | "enemy",
  includeBonuses: boolean,
): RpmHudElements {
  const card = document.createElement("div");
  card.className = `rpm-card ${variant}`;
  const label = document.createElement("div");
  label.className = "rpm-label";
  label.append(
    Object.assign(document.createElement("span"), { textContent: participant.name }),
    Object.assign(document.createElement("span"), { textContent: `${Math.ceil(participant.currentRPM)} / ${Math.ceil(participant.maxRPM)} RPM` }),
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
