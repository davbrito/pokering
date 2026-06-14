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

// ─── MoveInfo: Discriminated Union (V2) ──────────────────────────────────────
// Cada variante tiene los campos exactos que necesita.
// El discriminador es `damageClass`.

interface BaseMoveFields {
  name: string;
  type: string;
  accuracy: number | null;
}

export interface PhysicalMove extends BaseMoveFields {
  damageClass: "physical";
  power: number;
}

export interface SpecialMove extends BaseMoveFields {
  damageClass: "special";
  power: number;
}

export type StatChangeEffect = {
  kind: "stat-change";
  changes: Array<{ stat: "atk" | "def" | "spa" | "spd" | "spe"; change: number }>;
};

export type AilmentEffect = {
  kind: "ailment";
  ailment: "burn" | "paralysis";
};

export type HealEffect = {
  kind: "heal";
  percentage: number;
};

export type StatusEffect = StatChangeEffect | AilmentEffect | HealEffect;

export interface StatusMove extends BaseMoveFields {
  damageClass: "status";
  power: null;
  effect: StatusEffect;
}

export type MoveInfo = PhysicalMove | SpecialMove | StatusMove;

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

// ─── Status (acción activa: stat-change, ailment, heal) ──────────────────────

export type StatusPayload =
  | { subType: "stat-change"; stat: "atk" | "def" | "spa" | "spd" | "spe"; change: number; currentStage: number }
  | { subType: "ailment"; name: "burn" | "paralysis" }
  | { subType: "heal"; amount: number; currentHp: number };

export interface BattleStatusStep {
  type: "status";
  targetIdx: number;
  moveName: string;
  payload: StatusPayload;
}

// ─── Passive (consecuencia pasiva: residual-damage, restriction) ─────────────

export type PassivePayload =
  | { subType: "residual-damage"; reason: "burn"; damage: number; currentHp: number }
  | { subType: "restriction"; reason: "paralysis" };

export interface BattlePassiveStep {
  type: "passive";
  targetIdx: number;
  payload: PassivePayload;
}

// ─── AilmentState ────────────────────────────────────────────────────────────

export interface AilmentState {
  type: "burn" | "paralysis" | null;
}

export interface StatStages {
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

export type BattleStep =
  | BattleStartStep
  | BattleActionStep
  | BattleMissStep
  | BattleFaintStep
  | BattleEndStep
  | BattleStatusStep
  | BattlePassiveStep;
