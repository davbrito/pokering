// Las 6 stats base de un Pokémon.
// atk/def se usan con movimientos physical; spa/spd con movimientos special.
// spe determina quién ataca primero en el turno.
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
  accuracy: number | null;
  eff: number;
}

// Movimiento listo para combate. Solo existen physical y special;
// los movimientos Status (sin power) se filtran en fetchSingleMove.
// accuracy: null = nunca falla (ej. Swift, Aerial Ace).
export interface RealMoveInfo {
  name: string;
  type: string;
  category: "physical" | "special";
  power: number;
  accuracy: number | null;
}

export interface BattleStep {
  type: "start" | "action" | "miss" | "faint" | "end";
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
