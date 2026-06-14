import type { QueryClient } from "@tanstack/react-query";
import { random } from "es-toolkit/math";
import type { PokemonDetail } from "../api/pokeapi";
import { moveRetrieveOptions } from "../api/pokeapi/@tanstack/react-query.gen";
import type { MoveDetail } from "../api/pokeapi/types.gen";
import { TYPE_CHART } from "./data";
import { coinFlip, randomProbability } from "./random";
import type {
  AilmentState,
  BattleStep,
  MoveInfo,
  MoveResult,
  PokemonStats,
  RealMoveInfo,
  StatStages,
  StatusEffect,
} from "./types";

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
      damageClass: "status",
      power: null,
      effect: parseStatusEffect(raw.meta, raw.stat_changes),
    };
  }

  return {
    name,
    type,
    accuracy,
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

/**
 * Aplica la estrategia de 4 slots: pule un pool de movimientos a exactamente 4,
 * escogiendo el mejor de cada categoría estratégica.
 *
 *   Slot 1: Mejor movimiento físico (mayor power)
 *   Slot 2: Mejor movimiento especial (mayor power)
 *   Slot 3: Primer stat-change o heal (net-good-stats/heal)
 *   Slot 4: Primer ailment
 */
export function selectBattleMoves(pool: MoveInfo[]): MoveInfo[] {
  const physical = pool.filter((m) => m.damageClass === "physical").sort((a, b) => b.power - a.power);
  const special = pool.filter((m) => m.damageClass === "special").sort((a, b) => b.power - a.power);
  const stat = pool.find(
    (m) => m.damageClass === "status" && (m.effect.kind === "stat-change" || m.effect.kind === "heal"),
  );

  const ailment = pool.find((m) => m.damageClass === "status" && m.effect.kind === "ailment");

  const result: MoveInfo[] = [];

  if (physical.length > 0) result.push(physical[0]);
  if (special.length > 0) result.push(special[0]);
  if (stat) result.push(stat);
  if (ailment) result.push(ailment);

  return result;
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

// Retorna multiplicador de efectividad acumulado
export function getEffectiveness(attackerType: string, defenderTypes: string[]): number {
  const attackerChart = TYPE_CHART[attackerType];
  if (!attackerChart) return 1; // Si el tipo atacante no está en la tabla, se asume efectividad normal
  return defenderTypes
    .values()
    .filter((defType) => attackerChart[defType] !== undefined)
    .reduce((eff, defType) => eff * attackerChart[defType], 1);
}

// STAB (Same Type Attack Bonus): si el tipo del movimiento coincide
// con uno de los tipos del atacante, el daño se multiplica por 1.5.
export function getStabMultiplier(moveType: string, attackerTypes: string[]): number {
  return attackerTypes.includes(moveType) ? 1.5 : 1;
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
export function selectBestMove(
  attackerStats: PokemonStats,
  attackerTypes: string[],
  defenderTypes: string[],
  defenderStats: PokemonStats,
  moves: RealMoveInfo[],
): MoveResult {
  let bestMove: MoveResult | null = null;
  let maxDamagePotential = -1;

  for (const move of moves) {
    // Según la damage_class del movimiento se eligen las stats correctas:
    // - Physical: Atk del atacante vs Def del defensor
    // - Special:  SpA del atacante vs SpD del defensor
    // (Los movimientos Status ya fueron filtrados en fetchSingleMove)
    const offensiveStat = move.category === "physical" ? attackerStats.atk : attackerStats.spa;
    const defensiveStat = move.category === "physical" ? defenderStats.def : defenderStats.spd;

    const typeEff = getEffectiveness(move.type, defenderTypes);
    const stab = getStabMultiplier(move.type, attackerTypes);
    // Estimación: (stat ofensivo / stat defensivo) * poder * STAB * efectividad
    // Se añade un factor aleatorio (±10%) para que el "mejor" movimiento
    // no sea siempre el mismo de forma determinista.
    const randomness = random(0.9, 1.1);
    const expectedDmg = (offensiveStat / defensiveStat) * move.power * stab * typeEff * randomness;

    if (expectedDmg > maxDamagePotential) {
      maxDamagePotential = expectedDmg;
      bestMove = {
        name: move.name,
        type: move.type,
        category: move.category,
        power: move.power,
        accuracy: move.accuracy,
        eff: typeEff,
      };
    }
  }

  return (
    bestMove || {
      name: "struggle",
      type: "normal",
      category: "physical",
      power: 50,
      accuracy: null,
      eff: 1,
    }
  );
}

export function calcHpStat(baseHp: number): number {
  return baseHp * 2 + 110;
}

/**
 * Escala las estadísticas base de un Pokémon según su nivel,
 * usando las fórmulas oficiales (asumiendo 0 EVs/IVs).
 *
 *   HP:   floor((2 × base × level) / 100) + level + 10
 *   Stat: floor((2 × base × level) / 100) + 5
 */
export function scaleStatsByLevel(base: PokemonStats, level: number): PokemonStats {
  const scale = (b: number) => Math.floor((2 * b * level) / 100);
  return {
    hp: scale(base.hp) + level + 10,
    atk: scale(base.atk) + 5,
    def: scale(base.def) + 5,
    spa: scale(base.spa) + 5,
    spd: scale(base.spd) + 5,
    spe: scale(base.spe) + 5,
  };
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

/**
 * Heurística de IA para elegir movimiento entre daño y estado.
 *
 * Evalúa primero los movimientos de estado según la situación:
 *   - heal si HP < 50%
 *   - ailment si el rival no tiene estado
 *   - buff de estadística (atk/spa) si el stage está bajo
 * Si no aplica ningún estado, o el azar cae en el 70% de daño,
 * elige el ataque físico/especial con mayor daño esperado.
 */
export function selectMove(
  moves: MoveInfo[],
  attackerStats: PokemonStats,
  attackerTypes: string[],
  defenderTypes: string[],
  defenderStats: PokemonStats,
  currentHp: number,
  maxHp: number,
  defenderAilment: AilmentState,
  attackerStages: StatStages,
): MoveInfo {
  if (moves.length === 0) return struggleMove;

  // Separar ataques y estados
  const attacks = moves.filter((m) => m.damageClass === "physical" || m.damageClass === "special");
  const statusMoves = moves.filter((m) => m.damageClass === "status");

  // 70% → ataque (o si no hay estados útiles)
  const shouldUseStatus = statusMoves.length > 0 && randomProbability(0.3);

  if (!shouldUseStatus) {
    return pickBestAttack(attacks, attackerStats, attackerTypes, defenderTypes, defenderStats) ?? moves[0];
  }

  // 30% → intentar estado táctico
  // Heal si HP bajo
  if (currentHp / maxHp < 0.5) {
    const heal = statusMoves.find((m) => m.effect.kind === "heal");
    if (heal) return heal;
  }

  // Ailment si el rival no tiene uno
  if (defenderAilment.type === null) {
    const ailmentMove = statusMoves.find((m) => m.effect.kind === "ailment");
    if (ailmentMove) return ailmentMove;
  }

  // Buff de ataque si el stage no está en máximo
  const atkStage = attackerStages.atk;
  const spaStage = attackerStages.spa;
  const highestOff = attackerStats.atk > attackerStats.spa ? "atk" : "spa";
  const statBuff = statusMoves.find(
    (m) =>
      m.effect.kind === "stat-change" &&
      m.effect.changes.length === 1 &&
      m.effect.changes[0].stat === highestOff &&
      (highestOff === "atk" ? atkStage : spaStage) < 4,
  );
  if (statBuff) return statBuff;

  // Fallback: mejor ataque
  return pickBestAttack(attacks, attackerStats, attackerTypes, defenderTypes, defenderStats) ?? moves[0];
}

/** Elige el ataque físico/especial con mayor daño esperado. */
function pickBestAttack(
  attacks: MoveInfo[],
  attackerStats: PokemonStats,
  attackerTypes: string[],
  defenderTypes: string[],
  defenderStats: PokemonStats,
): MoveInfo | null {
  if (attacks.length === 0) return null;

  let best = attacks[0];
  let maxDmg = -1;

  for (const move of attacks) {
    if (move.damageClass === "physical" || move.damageClass === "special") {
      const offStat = move.damageClass === "physical" ? attackerStats.atk : attackerStats.spa;
      const defStat = move.damageClass === "physical" ? defenderStats.def : defenderStats.spd;
      const typeEff = getEffectiveness(move.type, defenderTypes);
      const stab = getStabMultiplier(move.type, attackerTypes);

      // Valor Esperado: daño bruto penalizado por riesgo de fallo
      const trueAccuracy = move.accuracy ?? 100;
      const baseExpected = (offStat / defStat) * move.power * stab * typeEff * (trueAccuracy / 100);

      // Ruido táctico ampliado: la IA no es perfecta
      const tacticalNoise = random(0.7, 1.3);
      const valuation = baseExpected * tacticalNoise;

      if (valuation > maxDmg) {
        maxDmg = valuation;
        best = move;
      }
    }
  }

  return best;
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

/** Movimiento de fallback cuando un Pokémon no tiene movimientos válidos. */
const struggleMove: MoveInfo = {
  damageClass: "physical",
  name: "struggle",
  type: "normal",
  accuracy: null,
  power: 50,
};

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
): {
  steps: BattleStep[];
  hp1: number;
  hp2: number;
  p1Stages: StatStages;
  p2Stages: StatStages;
  p1Ailment: AilmentState;
  p2Ailment: AilmentState;
} {
  const steps: BattleStep[] = [];

  // ── Fase 1: selección simultánea de movimientos ──
  const p1Move = selectMove(p1Moves, p1s, pt1, pt2, p2s, hp1, maxHp1, p2Ailment, p1Stages);
  const p2Move = selectMove(p2Moves, p2s, pt2, pt1, p1s, hp2, maxHp2, p1Ailment, p2Stages);

  // ── Fase 2: determinar orden de ataque por velocidad (con stages) ──
  const effectiveSpe1 = p1s.spe * getStageMultiplier(p1Stages.spe);
  const effectiveSpe2 = p2s.spe * getStageMultiplier(p2Stages.spe);
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

  for (const attack of queue) {
    if (currentHp1 <= 0 || currentHp2 <= 0) break;

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
      // Calculate temp eff for MoveInfo without MoveResult
      const eff = getEffectiveness(attack.move.type, attack.attackerIdx === 0 ? pt2 : pt1);
      const atkLevel = attack.attackerIdx === 0 ? level1 : level2;
      const { damage: finalDamage, isCrit } = calculateAttackDamage(
        atkLevel,
        attack.move.power,
        attack.offStat,
        attack.defStat,
        attack.stab,
        eff,
      );

      const preHp: [number, number] = [currentHp1, currentHp2];

      if (attack.attackerIdx === 0) {
        currentHp2 = Math.max(0, currentHp2 - finalDamage);
      } else {
        currentHp1 = Math.max(0, currentHp1 - finalDamage);
      }
      const postHp: [number, number] = [currentHp1, currentHp2];

      steps.push({
        type: "action",
        attackerIdx: attack.attackerIdx,
        moveName: attack.move.name,
        moveType: attack.move.type,
        category: attack.move.damageClass,
        damage: finalDamage,
        isCrit,
        eff,
        preHp,
        postHp,
      });

      if (attack.attackerIdx === 0 && currentHp2 <= 0) {
        steps.push({ type: "faint", faintedIdx: 1 });
        break;
      }
      if (attack.attackerIdx === 1 && currentHp1 <= 0) {
        steps.push({ type: "faint", faintedIdx: 0 });
        break;
      }
    } else {
      // ── Movimiento de estado (V2) ──
      const targetIdx = attack.attackerIdx === 0 ? 1 : 0;
      const targetHp = targetIdx === 0 ? currentHp1 : currentHp2;
      const targetMaxHp = targetIdx === 0 ? maxHp1 : maxHp2;
      const targetStages = targetIdx === 0 ? currentStages1 : currentStages2;
      const targetAilment = targetIdx === 0 ? currentAilment1 : currentAilment2;

      const statusResult = applyStatusEffect(
        attack.move.effect,
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

      // Faint check for residual damage
      if (currentHp1 <= 0) {
        steps.push({ type: "faint", faintedIdx: 0 });
        break;
      }
      if (currentHp2 <= 0) {
        steps.push({ type: "faint", faintedIdx: 1 });
        break;
      }
    }
  }

  // ── Fase 4: Desgaste pasivo (quemadura) ──
  const burn1 = applyEndOfTurnDamage(currentAilment1, 0, maxHp1, currentHp1);
  if (burn1.damage > 0) {
    steps.push(...burn1.steps);
    currentHp1 = burn1.hp;
    if (burn1.fainted) steps.push({ type: "faint", faintedIdx: 0 });
  }

  const burn2 = applyEndOfTurnDamage(currentAilment2, 1, maxHp2, currentHp2);
  if (burn2.damage > 0) {
    steps.push(...burn2.steps);
    currentHp2 = burn2.hp;
    if (burn2.fainted) steps.push({ type: "faint", faintedIdx: 1 });
  }

  return {
    steps,
    hp1: currentHp1,
    hp2: currentHp2,
    p1Stages: currentStages1,
    p2Stages: currentStages2,
    p1Ailment: currentAilment1,
    p2Ailment: currentAilment2,
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

  steps.push({ type: "start" });

  let turn = 1;
  while (hp1 > 0 && hp2 > 0 && turn <= 15) {
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
    );
    steps.push(...round.steps);
    hp1 = round.hp1;
    hp2 = round.hp2;
    p1Stages = round.p1Stages;
    p2Stages = round.p2Stages;
    p1Ailment = round.p1Ailment;
    p2Ailment = round.p2Ailment;
    turn++;
  }

  const winnerIdx = hp1 > 0 ? 0 : 1;
  steps.push({ type: "end", winnerIdx });

  return steps;
}
