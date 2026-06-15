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

// ─── MoveInfo: Discriminated Union (V2) ──────────────────────────────────────
// Cada variante tiene los campos exactos que necesita.
// El discriminador es `damageClass`.

interface BaseMoveFields {
  name: string;
  type: string;
  accuracy: number | null;
  pp: number;
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

export const SUPPORTED_AILMENTS = ["burn", "paralysis"] as const;
export type AilmentName = (typeof SUPPORTED_AILMENTS)[number];

export function isSupportedAilment(name: string): name is AilmentName {
  return (SUPPORTED_AILMENTS as readonly string[]).includes(name);
}

export type AilmentEffect = {
  kind: "ailment";
  ailment: AilmentName;
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

export interface BattleUseMoveStep {
  type: "use-move";
  attackerIdx: number;
  move: MoveInfo;
}

export interface BattleDamageStep {
  type: "damage";
  targetIdx: number;
  damage: number;
  isCrit: boolean;
  eff: number;
  currentHp: number;
}

export interface BattleMissStep {
  type: "miss";
  attackerIdx: number;
  moveName: string;
}

export interface BattleImmuneStep {
  type: "immune";
  attackerIdx: number;
  targetIdx: number;
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
  | { subType: "ailment"; name: AilmentName }
  | { subType: "heal"; amount: number; currentHp: number };

export interface BattleStatusStep {
  type: "status";
  attackerIdx: number;
  targetIdx: number;
  moveName: string;
  payload: StatusPayload;
}

// ─── Passive (consecuencia pasiva: residual-damage, restriction) ─────────────

export type PassivePayload =
  | { subType: "residual-damage"; reason: "burn"; damage: number; currentHp: number }
  | { subType: "recoil"; damage: number; currentHp: number }
  | { subType: "restriction"; reason: "paralysis" };

export interface BattlePassiveStep {
  type: "passive";
  targetIdx: number;
  payload: PassivePayload;
}

// ─── AilmentState ────────────────────────────────────────────────────────────

export interface AilmentState {
  type: AilmentName | null;
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
  | BattleUseMoveStep
  | BattleDamageStep
  | BattleMissStep
  | BattleImmuneStep
  | BattleFaintStep
  | BattleEndStep
  | BattleStatusStep
  | BattlePassiveStep;

/** Estado completo de un Pokémon dentro de una ronda de combate. */
export interface PlayerState {
  stats: PokemonStats;
  types: string[];
  moves: MoveInfo[];
  stages: StatStages;
  ailment: AilmentState;
  hp: number;
  maxHp: number;
  level: number;
  pp: number[];
  /** stats escalados por nivel, modificables (p.ej. parálisis reduce spe). */
  currentStats: PokemonStats;
}
