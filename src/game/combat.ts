import type { QueryClient } from "@tanstack/react-query";
import { random } from "es-toolkit/math";
import type { PokemonDetail } from "../api/pokeapi";
import { moveRetrieveOptions } from "../api/pokeapi/@tanstack/react-query.gen";
import type { MoveDetail, PokemonStat } from "../api/pokeapi/types.gen";
import { getEffectiveness, getStabMultiplier, selectBattleMoves, selectMove, struggleMove } from "./combat/moves";
import { coinFlip, randomProbability } from "./random";
import type { AilmentState, BattleStep, MoveInfo, PokemonStats, StatStages, StatusEffect } from "./types";

/**
 * Transforma un MoveDetail crudo de la PokéAPI en un MoveInfo limpio
 * con discriminación por damageClass. Puro, sin efectos secundarios,
 * 100% testeable sin mocks de red.
 */
export function mapMoveToMoveInfo(raw: MoveDetail): MoveInfo {
  const name = raw.names.find((n) => n.language.name === "es")?.name || raw.name;
  const type = raw.type.name;
  const accuracy = raw.accuracy ?? null;
  const dc = raw.damage_class.name;

  if (dc === "status") {
    return {
      name,
      type,
      accuracy,
      pp: raw.pp ?? 10,
      damageClass: "status",
      power: null,
      effect: parseStatusEffect(raw.meta, raw.stat_changes),
    };
  }

  return {
    name,
    type,
    accuracy,
    pp: raw.pp ?? 10,
    damageClass: dc as "physical" | "special",
    power: raw.power ?? 0,
  };
}

/** Convierte los metadatos de un movimiento de status en un StatusEffect tipado. */
function parseStatusEffect(meta: MoveDetail["meta"], statChanges: MoveDetail["stat_changes"]): StatusEffect {
  const cat = meta.category.name;

  if (cat === "net-good-stats" && statChanges.length > 0) {
    return {
      kind: "stat-change",
      changes: statChanges.map((sc) => ({
        stat: mapApiStatName(sc.stat.name),
        change: sc.change,
      })),
    };
  }

  if (cat === "ailment" && meta.ailment.name !== "none") {
    const ailmentName = meta.ailment.name;
    if (ailmentName === "burn" || ailmentName === "paralysis") {
      return { kind: "ailment", ailment: ailmentName };
    }
  }

  if (cat === "heal" && meta.healing && meta.healing > 0) {
    return { kind: "heal", percentage: meta.healing };
  }

  // Fallback: si la API no clasifica bien, devolvemos un stat-change vacío
  return { kind: "stat-change", changes: [] };
}

/** Mapea nombres de stats de la PokéAPI a nuestras claves internas. */
function mapApiStatName(raw: string): "atk" | "def" | "spa" | "spd" | "spe" {
  const map: Record<string, "atk" | "def" | "spa" | "spd" | "spe"> = {
    attack: "atk",
    defense: "def",
    "special-attack": "spa",
    "special-defense": "spd",
    speed: "spe",
  };
  return map[raw] || "atk";
}

export async function fetchPokemonMoves(queryClient: QueryClient, pokemon: PokemonDetail): Promise<MoveInfo[]> {
  const movesNames = [...new Set(pokemon.moves.map((m) => m.move.name))];
  const results = await Promise.all(movesNames.map((name) => fetchSingleMove(queryClient, name)));
  const valid = results.filter((r): r is MoveInfo => r !== null);
  // Aplicar estrategia de 4 slots estratégicos
  return selectBattleMoves(valid);
}

async function fetchSingleMove(queryClient: QueryClient, name: string): Promise<MoveInfo | null> {
  try {
    const data = await queryClient.ensureQueryData(moveRetrieveOptions({ path: { id: name } }));
    if (!data) return null;
    return mapMoveToMoveInfo(data);
  } catch {
    return null;
  }
}

// Extrae las 6 estadísticas base (HP, Atk, Def, SpA, SpD, Spe) de la API.
// atk/def → movimientos physical; spa/spd → movimientos special.
// spe determina el orden de ataque en cada turno (ver determineFirstAttacker).
export function getStatsObject(p: PokemonDetail): PokemonStats {
  const gs = (name: string) => p.stats.find((s) => s.stat.name === name)?.base_stat || 0;
  return {
    hp: gs("hp"),
    atk: gs("attack"),
    def: gs("defense"),
    spa: gs("special-attack"),
    spd: gs("special-defense"),
    spe: gs("speed"),
  };
}

// Selecciona el mejor movimiento del array de movimientos reales del Pokémon.
// Recibe los tipos del atacante para aplicar STAB en la estimación de daño.
export function calcHpStat(baseHp: number): number {
  return baseHp * 2 + 110;
}

function scaleStat(base: number, level: number, extra: number): number {
  return Math.floor((2 * base * level) / 100) + extra;
}

/**
 * Escala las estadísticas base de un Pokémon según su nivel,
 * usando las fórmulas oficiales (asumiendo 0 EVs/IVs).
 *
 *   HP:   floor((2 × base × level) / 100) + level + 10
 *   Stat: floor((2 × base × level) / 100) + 5
 */
export function scaleStatsByLevel(base: PokemonStats, level: number): PokemonStats {
  return {
    hp: scaleStat(base.hp, level, level + 10),
    atk: scaleStat(base.atk, level, 5),
    def: scaleStat(base.def, level, 5),
    spa: scaleStat(base.spa, level, 5),
    spd: scaleStat(base.spd, level, 5),
    spe: scaleStat(base.spe, level, 5),
  };
}

export function scaleStatByLevel(base: PokemonStat, level: number): PokemonStat {
  return {
    ...base,
    base_stat:
      base.stat.name === "hp" ? scaleStat(base.base_stat, level, level + 10) : scaleStat(base.base_stat, level, 5),
  };
}

export function scaleStatsArrayByLevel(stats: PokemonStat[], level: number): PokemonStat[] {
  return stats.map((s) => scaleStatByLevel(s, level));
}

/**
 * Convierte un stage de estadística (-6 a +6) en su multiplicador oficial.
 *
 * Fórmula Pokémon (Gen 3+):
 *   stage >= 0 → (2 + stage) / 2
 *   stage <  0 → 2 / (2 - stage)
 *
 * Ejemplos: +2 → 2x, -2 → 0.5x, +6 → 4x, -6 → 0.25x
 * Stages fuera de [-6, 6] se recortan silenciosamente.
 */
export function getStageMultiplier(stage: number): number {
  const bounded = Math.max(-6, Math.min(6, stage));
  if (bounded >= 0) {
    return (2 + bounded) / 2;
  }
  return 2 / (2 - bounded);
}

/** Resultado de aplicar un efecto de estado a un Pokémon. */
export interface StatusEffectResult {
  hp: number;
  stages: StatStages;
  ailment: AilmentState;
  steps: BattleStep[];
}

/**
 * Aplica un StatusEffect (heal, stat-change, ailment) a un Pokémon
 * y retorna el estado actualizado + los steps generados.
 */
export function applyStatusEffect(
  effect: StatusEffect,
  attackerIdx: number,
  targetIdx: number,
  moveName: string,
  currentHp: number,
  maxHp: number,
  stages: StatStages,
  ailment: AilmentState,
): StatusEffectResult {
  const steps: BattleStep[] = [];

  switch (effect.kind) {
    case "heal": {
      const healAmount = Math.floor(maxHp * (effect.percentage / 100));
      const newHp = Math.min(maxHp, currentHp + healAmount);
      const actualHeal = newHp - currentHp;

      steps.push({
        type: "status",
        attackerIdx,
        targetIdx,
        moveName,
        payload: { subType: "heal", amount: actualHeal, currentHp: newHp },
      });

      return { hp: newHp, stages, ailment, steps };
    }

    case "stat-change": {
      const newStages = { ...stages };

      for (const ch of effect.changes) {
        const oldStage = newStages[ch.stat];
        const clamped = Math.max(-6, Math.min(6, oldStage + ch.change));
        newStages[ch.stat] = clamped;

        if (clamped !== oldStage) {
          steps.push({
            type: "status",
            attackerIdx,
            targetIdx,
            moveName,
            payload: { subType: "stat-change", stat: ch.stat, change: ch.change, currentStage: clamped },
          });
        }
      }

      return { hp: currentHp, stages: newStages, ailment, steps };
    }

    case "ailment": {
      if (ailment.type === null) {
        const newAilment: AilmentState = { type: effect.ailment };

        steps.push({
          type: "status",
          attackerIdx,
          targetIdx,
          moveName,
          payload: { subType: "ailment", name: effect.ailment },
        });

        return { hp: currentHp, stages, ailment: newAilment, steps };
      }
      // Ya tiene un estado: se trata como fallo (no se emite step)
      return { hp: currentHp, stages, ailment, steps };
    }
  }

  // Por defecto no cambia nada
  return { hp: currentHp, stages, ailment, steps };
}

/** Resultado de aplicar daño de fin de turno (quemadura). */
export interface EndOfTurnResult {
  hp: number;
  damage: number;
  fainted: boolean;
  steps: BattleStep[];
}

/**
 * Procesa el daño pasivo al final de un turno basado en el estado alterado.
 * - Quemadura (burn): 1/16 del HP máximo.
 */
export function applyEndOfTurnDamage(
  ailment: AilmentState,
  targetIdx: number,
  maxHp: number,
  currentHp: number,
): EndOfTurnResult {
  const steps: BattleStep[] = [];

  if (ailment.type === "burn") {
    const damage = Math.max(1, Math.floor(maxHp / 16));
    const newHp = Math.max(0, currentHp - damage);

    steps.push({
      type: "passive",
      targetIdx,
      payload: { subType: "residual-damage", reason: "burn", damage, currentHp: newHp },
    });

    return { hp: newHp, damage, fainted: newHp <= 0, steps };
  }

  return { hp: currentHp, damage: 0, fainted: false, steps };
}

export function determineFirstAttacker(speP1: number, speP2: number): boolean {
  if (speP1 > speP2) return true;
  if (speP2 > speP1) return false;
  // Empate de velocidad: coin flip aleatorio
  return coinFlip();
}

/**
 * Calcula el daño final de un ataque usando la fórmula oficial (Gen 3+).
 *
 * Fórmula:
 *   base = (((2 * level / 5 + 2) * power * (offensiveStat / defensiveStat)) / 50 + 2)
 *   final = floor(base * stab * typeEff * crit * random)
 *
 * - crit: 12% de probabilidad de crítico (×1.5)
 * - random: factor uniforme entre 0.85 y 1.00
 * - Si el daño es 0 pero hay efectividad (> 0), se fuerza a 1.
 */
export function calculateAttackDamage(
  level: number,
  power: number,
  offensiveStat: number,
  defensiveStat: number,
  stab: number,
  typeEff: number,
): { damage: number; isCrit: boolean } {
  const baseDamage = (((2 * level) / 5 + 2) * power * (offensiveStat / defensiveStat)) / 50 + 2;

  const isCrit = randomProbability(0.12);
  const critMultiplier = isCrit ? 1.5 : 1;
  const randomMultiplier = random(0.85, 1.0);

  let damage = Math.floor(baseDamage * stab * typeEff * critMultiplier * randomMultiplier);
  if (damage <= 0 && typeEff > 0) damage = 1;

  return { damage, isCrit };
}

/**
 * Resuelve una ronda de combate Pokémon.
 *
 * Cada ronda sigue el flujo canónico:
 * 1. Ambos Pokémon seleccionan su movimiento simultáneamente (PC vs PC: automático).
 * 2. Se determina quién ataca primero según velocidad (Speed).
 * 3. Los movimientos se ejecutan en orden; si el defensor se debilita antes de
 *    ejecutar su movimiento, ese movimiento se pierde (no se emite step).
 *
 * Retorna los BattleStep generados en esta ronda y los HP actualizados.
 */
/**
 * Resuelve una ronda de combate Pokémon.
 *
 * Cada ronda sigue el flujo canónico:
 * 1. Ambos Pokémon seleccionan su movimiento simultáneamente (PC vs PC: automático).
 * 2. Se determina quién ataca primero según velocidad (Speed).
 * 3. Los movimientos se ejecutan en orden; si el defensor se debilita antes de
 *    ejecutar su movimiento, ese movimiento se pierde (no se emite step).
 *
 * Retorna los BattleStep generados en esta ronda y los HP actualizados.
 */
function resolveRound(
  p1s: PokemonStats,
  p2s: PokemonStats,
  pt1: string[],
  pt2: string[],
  p1Moves: MoveInfo[],
  p2Moves: MoveInfo[],
  p1Stages: StatStages,
  p2Stages: StatStages,
  p1Ailment: AilmentState,
  p2Ailment: AilmentState,
  hp1: number,
  hp2: number,
  maxHp1: number,
  maxHp2: number,
  level1: number,
  level2: number,
  p1Pp: number[],
  p2Pp: number[],
): {
  steps: BattleStep[];
  hp1: number;
  hp2: number;
  p1Stages: StatStages;
  p2Stages: StatStages;
  p1Ailment: AilmentState;
  p2Ailment: AilmentState;
  p1Pp: number[];
  p2Pp: number[];
} {
  const steps: BattleStep[] = [];

  // ── Fase 1: selección simultánea de movimientos ──
  // Filtrar movimientos con PP restante; si no hay, usar Struggle
  const availableP1Moves = p1Moves.length > 0 ? p1Moves.filter((_, i) => p1Pp[i] > 0) : [];
  const availableP2Moves = p2Moves.length > 0 ? p2Moves.filter((_, i) => p2Pp[i] > 0) : [];
  const p1Move =
    availableP1Moves.length > 0
      ? selectMove(availableP1Moves, p1s, pt1, pt2, p2s, hp1, maxHp1, p2Ailment, p1Stages)
      : struggleMove;
  const p2Move =
    availableP2Moves.length > 0
      ? selectMove(availableP2Moves, p2s, pt2, pt1, p1s, hp2, maxHp2, p1Ailment, p2Stages)
      : struggleMove;

  // ── Fase 2: determinar orden de ataque por velocidad (con stages y parálisis) ──
  const paraMod1 = p1Ailment.type === "paralysis" ? 0.5 : 1;
  const paraMod2 = p2Ailment.type === "paralysis" ? 0.5 : 1;

  const effectiveSpe1 = p1s.spe * getStageMultiplier(p1Stages.spe) * paraMod1;
  const effectiveSpe2 = p2s.spe * getStageMultiplier(p2Stages.spe) * paraMod2;
  const p1First = determineFirstAttacker(effectiveSpe1, effectiveSpe2);

  // ── Fase 3: ejecutar en orden ──
  // Construimos la cola de ataques en orden: [primero, segundo]
  interface QueuedAttack {
    move: MoveInfo;
    attackerIdx: number;
    offStat: number;
    defStat: number;
    stab: number;
    targetHp: number;
    targetMaxHp: number;
    targetStages: StatStages;
    targetAilment: AilmentState;
  }

  const buildAttack = (move: MoveInfo, isP1: boolean): QueuedAttack => {
    if (move.damageClass === "physical" || move.damageClass === "special") {
      const isPhys = move.damageClass === "physical";
      return {
        move,
        attackerIdx: isP1 ? 0 : 1,
        offStat:
          (isPhys ? (isP1 ? p1s.atk : p2s.atk) : isP1 ? p1s.spa : p2s.spa) *
          getStageMultiplier(isPhys ? (isP1 ? p1Stages.atk : p2Stages.atk) : isP1 ? p1Stages.spa : p2Stages.spa),
        defStat:
          (isPhys ? (isP1 ? p2s.def : p1s.def) : isP1 ? p2s.spd : p1s.spd) *
          getStageMultiplier(isPhys ? (isP1 ? p2Stages.def : p1Stages.def) : isP1 ? p2Stages.spd : p1Stages.spd),
        stab: getStabMultiplier(move.type, isP1 ? pt1 : pt2),
        targetHp: isP1 ? hp2 : hp1,
        targetMaxHp: isP1 ? maxHp2 : maxHp1,
        targetStages: isP1 ? p2Stages : p1Stages,
        targetAilment: isP1 ? p2Ailment : p1Ailment,
      };
    }
    // Status moves target the opponent for now
    return {
      move,
      attackerIdx: isP1 ? 0 : 1,
      offStat: 0,
      defStat: 0,
      stab: 1,
      targetHp: isP1 ? hp2 : hp1,
      targetMaxHp: isP1 ? maxHp2 : maxHp1,
      targetStages: isP1 ? p2Stages : p1Stages,
      targetAilment: isP1 ? p2Ailment : p1Ailment,
    };
  };

  const q1 = buildAttack(p1Move, true);
  const q2 = buildAttack(p2Move, false);

  const queue = p1First ? [q1, q2] : [q2, q1];

  let currentHp1 = hp1;
  let currentHp2 = hp2;
  let currentStages1 = { ...p1Stages };
  let currentStages2 = { ...p2Stages };
  let currentAilment1 = { ...p1Ailment };
  let currentAilment2 = { ...p2Ailment };
  const newPp1 = [...p1Pp];
  const newPp2 = [...p2Pp];

  const faintCheck = (): boolean => {
    if (currentHp1 <= 0) {
      steps.push({ type: "faint", faintedIdx: 0 });
      return true;
    }
    if (currentHp2 <= 0) {
      steps.push({ type: "faint", faintedIdx: 1 });
      return true;
    }
    return false;
  };

  for (const attack of queue) {
    if (currentHp1 <= 0 || currentHp2 <= 0) break;

    // Chequeo de Parálisis Total (25% de no poder moverse)
    const attackerAilment = attack.attackerIdx === 0 ? currentAilment1 : currentAilment2;
    if (attackerAilment.type === "paralysis" && randomProbability(0.25)) {
      steps.push({
        type: "passive",
        targetIdx: attack.attackerIdx,
        payload: { subType: "restriction", reason: "paralysis" },
      });
      continue;
    }

    // Descontar PP en cuanto el movimiento se declara (antes del chequeo de precisión)
    // Solo la parálisis total evita el descuento; el fallo por precisión SÍ consume PP.
    if (attack.move.pp > 0) {
      const moveIdx = (attack.attackerIdx === 0 ? p1Moves : p2Moves).findIndex((m) => m.name === attack.move.name);
      if (moveIdx !== -1) {
        if (attack.attackerIdx === 0) {
          newPp1[moveIdx]--;
        } else {
          newPp2[moveIdx]--;
        }
      }
    }

    // Chequeo de precisión (accuracy)
    const acc = attack.move.accuracy;
    if (acc !== null && acc < 100 && random(1, 100) > acc) {
      steps.push({
        type: "miss",
        attackerIdx: attack.attackerIdx,
        moveName: attack.move.name,
      });
      continue;
    }

    if (attack.move.damageClass === "physical" || attack.move.damageClass === "special") {
      // ── Daño físico/especial (V1) ──
      // Calculate temp eff
      const eff = getEffectiveness(attack.move.type, attack.attackerIdx === 0 ? pt2 : pt1);
      const atkLevel = attack.attackerIdx === 0 ? level1 : level2;
      let { damage: finalDamage, isCrit } = calculateAttackDamage(
        atkLevel,
        attack.move.power,
        attack.offStat,
        attack.defStat,
        attack.stab,
        eff,
      );

      // La quemadura corta el daño físico a la mitad
      if (attack.move.damageClass === "physical" && attackerAilment.type === "burn") {
        finalDamage = Math.max(1, Math.floor(finalDamage / 2));
      }

      steps.push({
        type: "use-move",
        attackerIdx: attack.attackerIdx,
        move: attack.move,
      });

      if (attack.attackerIdx === 0) {
        currentHp2 = Math.max(0, currentHp2 - finalDamage);
      } else {
        currentHp1 = Math.max(0, currentHp1 - finalDamage);
      }

      steps.push({
        type: "damage",
        targetIdx: attack.attackerIdx === 0 ? 1 : 0,
        damage: finalDamage,
        isCrit,
        eff,
        currentHp: attack.attackerIdx === 0 ? currentHp2 : currentHp1,
      });

      // Struggle recoil: 1/4 del HP máximo
      if (attack.move.name === "struggle") {
        const recoil = Math.max(1, Math.floor((attack.attackerIdx === 0 ? maxHp1 : maxHp2) / 4));
        if (attack.attackerIdx === 0) {
          currentHp1 = Math.max(0, currentHp1 - recoil);
        } else {
          currentHp2 = Math.max(0, currentHp2 - recoil);
        }
        steps.push({
          type: "passive",
          targetIdx: attack.attackerIdx,
          payload: { subType: "recoil", damage: recoil, currentHp: attack.attackerIdx === 0 ? currentHp1 : currentHp2 },
        });
      }

      if (faintCheck()) break;
    } else {
      // ── Movimiento de estado (V2) ──
      // heal y stat-change van al usuario; ailment va al rival
      const effect = attack.move.effect;
      const isSelfTarget = effect.kind === "heal" || effect.kind === "stat-change";
      const targetIdx = isSelfTarget ? attack.attackerIdx : attack.attackerIdx === 0 ? 1 : 0;
      steps.push({
        type: "use-move",
        attackerIdx: attack.attackerIdx,
        move: attack.move,
      });
      const targetHp = targetIdx === 0 ? currentHp1 : currentHp2;
      const targetMaxHp = targetIdx === 0 ? maxHp1 : maxHp2;
      const targetStages = targetIdx === 0 ? currentStages1 : currentStages2;
      const targetAilment = targetIdx === 0 ? currentAilment1 : currentAilment2;

      const statusResult = applyStatusEffect(
        effect,
        attack.attackerIdx,
        targetIdx,
        attack.move.name,
        targetHp,
        targetMaxHp,
        targetStages,
        targetAilment,
      );

      steps.push(...statusResult.steps);

      if (targetIdx === 0) {
        currentHp1 = statusResult.hp;
        currentStages1 = statusResult.stages;
        currentAilment1 = statusResult.ailment;
      } else {
        currentHp2 = statusResult.hp;
        currentStages2 = statusResult.stages;
        currentAilment2 = statusResult.ailment;
      }

      if (faintCheck()) break;
    }
  }

  // ── Fase 4: Desgaste pasivo (quemadura) ──
  // Solo evaluar a combatientes que siguen en pie para evitar faints duplicados
  if (currentHp1 > 0) {
    const burn1 = applyEndOfTurnDamage(currentAilment1, 0, maxHp1, currentHp1);
    if (burn1.damage > 0) {
      steps.push(...burn1.steps);
      currentHp1 = burn1.hp;
      if (burn1.fainted) steps.push({ type: "faint", faintedIdx: 0 });
    }
  }

  if (currentHp2 > 0) {
    const burn2 = applyEndOfTurnDamage(currentAilment2, 1, maxHp2, currentHp2);
    if (burn2.damage > 0) {
      steps.push(...burn2.steps);
      currentHp2 = burn2.hp;
      if (burn2.fainted) steps.push({ type: "faint", faintedIdx: 1 });
    }
  }

  return {
    steps,
    hp1: currentHp1,
    hp2: currentHp2,
    p1Stages: currentStages1,
    p2Stages: currentStages2,
    p1Ailment: currentAilment1,
    p2Ailment: currentAilment2,
    p1Pp: newPp1,
    p2Pp: newPp2,
  };
}

// GENERAR LA SECUENCIA DE PASOS DE COMBATE
export function generateBattleSteps(
  p1: PokemonDetail,
  p2: PokemonDetail,
  p1s: PokemonStats,
  p2s: PokemonStats,
  maxHp1: number,
  maxHp2: number,
  p1Moves: MoveInfo[],
  p2Moves: MoveInfo[],
  initialStages1?: StatStages,
  initialStages2?: StatStages,
  level1?: number,
  level2?: number,
): BattleStep[] {
  const steps: BattleStep[] = [];
  const pt1 = p1.types.map((t) => t.type.name);
  const pt2 = p2.types.map((t) => t.type.name);

  // Escalar stats según nivel
  const lv1 = level1 ?? 50;
  const lv2 = level2 ?? 50;
  const scaled1 = scaleStatsByLevel(p1s, lv1);
  const scaled2 = scaleStatsByLevel(p2s, lv2);
  const effectiveMaxHp1 = maxHp1 > 0 ? maxHp1 : scaled1.hp;
  const effectiveMaxHp2 = maxHp2 > 0 ? maxHp2 : scaled2.hp;

  let hp1 = effectiveMaxHp1;
  let hp2 = effectiveMaxHp2;

  // Stat stages: empiezan en 0, o usan los iniciales para testing
  let p1Stages = initialStages1 ?? { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  let p2Stages = initialStages2 ?? { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

  // Ailment state: ninguno al inicio
  let p1Ailment: AilmentState = { type: null };
  let p2Ailment: AilmentState = { type: null };

  // PP inicial: cada movimiento conserva su PP máximo
  let p1Pp = p1Moves.map((m) => m.pp);
  let p2Pp = p2Moves.map((m) => m.pp);

  steps.push({ type: "start" });

  while (hp1 > 0 && hp2 > 0) {
    const round = resolveRound(
      scaled1,
      scaled2,
      pt1,
      pt2,
      p1Moves,
      p2Moves,
      p1Stages,
      p2Stages,
      p1Ailment,
      p2Ailment,
      hp1,
      hp2,
      effectiveMaxHp1,
      effectiveMaxHp2,
      lv1,
      lv2,
      p1Pp,
      p2Pp,
    );
    steps.push(...round.steps);
    hp1 = round.hp1;
    hp2 = round.hp2;
    p1Stages = round.p1Stages;
    p2Stages = round.p2Stages;
    p1Ailment = round.p1Ailment;
    p2Ailment = round.p2Ailment;
    p1Pp = round.p1Pp;
    p2Pp = round.p2Pp;
  }

  const winnerIdx = hp1 > 0 ? 0 : 1;
  steps.push({ type: "end", winnerIdx });

  return steps;
}
