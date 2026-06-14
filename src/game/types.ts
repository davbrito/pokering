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

// ─── BattleStep: Discriminated Union ─────────────────────────────────────────
// Cada variante tiene exactamente los campos que le corresponden,
// sin propiedades opcionales. El discriminador es `type`.

export interface BattleStartStep {
  type: "start";
}

export interface BattleActionStep {
  type: "action";
  attackerIdx: number;
  moveName: string;
  moveType: string;
  category: "physical" | "special";
  damage: number;
  isCrit: boolean;
  eff: number;
  preHp: [number, number];
  postHp: [number, number];
}

export interface BattleMissStep {
  type: "miss";
  attackerIdx: number;
  moveName: string;
}

export interface BattleFaintStep {
  type: "faint";
  faintedIdx: number;
}

export interface BattleEndStep {
  type: "end";
  winnerIdx: number;
}

export type BattleStep = BattleStartStep | BattleActionStep | BattleMissStep | BattleFaintStep | BattleEndStep;
