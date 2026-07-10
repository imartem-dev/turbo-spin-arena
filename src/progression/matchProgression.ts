export type GameMode = "duel" | "deathmatch";
export type MatchOutcome = "victory" | "defeat" | "placed";
export type MatchResult = {
  mode: GameMode;
  outcome: MatchOutcome;
  place: number;
  kills: number;
  partsEarned: number;
  bonusClaimed: boolean;
};

export function calculateMatchReward(mode: GameMode, won: boolean, kills: number, place: number): number {
  if (mode === "duel") return 20 + (won ? 30 : 0);
  const placement = place === 1 ? 60 : place <= 3 ? 30 : 0;
  return 20 + Math.max(0, kills) * 10 + placement;
}
