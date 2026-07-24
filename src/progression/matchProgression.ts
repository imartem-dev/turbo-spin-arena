export type GameMode = "duel" | "deathmatch";
export type MatchOutcome = "victory" | "defeat";
export type MatchResult = {
  mode: GameMode;
  outcome: MatchOutcome;
  partsEarned: number;
  bonusClaimed: boolean;
};

export function calculateMatchReward(mode: GameMode, won: boolean, defeatedBeforePlayer: number): number {
  if (mode === "duel") return won ? 250 : 100;
  const rank = 10 - Math.min(9, Math.max(0, defeatedBeforePlayer));
  if (rank === 1) return 500;
  if (rank === 2) return 350;
  if (rank === 3) return 250;
  if (rank <= 5) return 180;
  if (rank <= 8) return 120;
  return 80;
}
