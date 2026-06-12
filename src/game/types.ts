export interface PokemonStats {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

export interface MoveResult {
  name: string;
  type: string;
  category: "physical" | "special";
  power: number;
  eff: number;
}

export interface RealMoveInfo {
  name: string;
  type: string;
  category: "physical" | "special";
  power: number;
}

export interface BattleStep {
  type: "start" | "action" | "faint" | "end";
  text: string;
  attackerIdx?: number;
  moveName?: string;
  moveType?: string;
  category?: "physical" | "special";
  damage?: number;
  isCrit?: boolean;
  eff?: number;
  preHp?: [number, number];
  postHp?: [number, number];
  faintedIdx?: number;
  winnerIdx?: number;
}
