import type { QueryClient } from "@tanstack/react-query";
import { random } from "es-toolkit/math";
import type { PokemonDetail } from "../api/pokeapi";
import { moveRetrieveOptions } from "../api/pokeapi/@tanstack/react-query.gen";
import { TYPE_CHART } from "./data";
import { coinFlip, randomProbability } from "./random";
import type { BattleStep, MoveResult, PokemonStats, RealMoveInfo } from "./types";

/** Nivel fijo al que combaten todos los Pokémon en esta simulación. */
const COMBAT_LEVEL = 50;

async function fetchSingleMove(queryClient: QueryClient, idOrName: string): Promise<RealMoveInfo | null> {
  try {
    const data = await queryClient.ensureQueryData(moveRetrieveOptions({ path: { id: idOrName } }));
    if (!data) return null;
    // V1: ignoramos movimientos sin power (Status como Growl, Thunder Wave)
    // Solo interesan movimientos que infligen daño directo.
    if (data.power == null || data.power === 0) return null;
    const dc = data.damage_class?.name;
    // Filtramos movimientos de estado (status). Solo physical y special pasan.
    // Physical usa atk/def; Special usa spa/spd. Ver selectBestMove().
    if (dc !== "physical" && dc !== "special") return null;
    return {
      name: data.names.find((n) => n.language.name === "es")?.name || data.name,
      type: data.type.name,
      category: dc,
      power: data.power,
      // accuracy null = nunca falla (ej. Swift, Aerial Ace)
      accuracy: data.accuracy ?? null,
    };
  } catch {
    return null;
  }
}

// Obtiene los movimientos reales de un Pokémon desde la API,
// usando queryClient para cachear los resultados
export async function fetchPokemonMoves(queryClient: QueryClient, pokemon: PokemonDetail): Promise<RealMoveInfo[]> {
  const movesNames = [...new Set(pokemon.moves.map((m) => m.move.name))];
  const results = await Promise.all(movesNames.map((name) => fetchSingleMove(queryClient, name)));
  const valid = results.filter((r): r is RealMoveInfo => r !== null);
  // Ordenados por poder descendente, top 20.
  // Esto garantiza que selectBestMove tenga los movimientos más fuertes
  // para elegir entre ellos según efectividad y stats.
  return valid.sort((a, b) => b.power - a.power).slice(0, 20);
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
 * Determina qué Pokémon ataca primero basándose en la estadística de Speed.
 * - Si P1 tiene más Speed, retorna true (P1 ataca primero).
 * - Si P2 tiene más Speed, retorna false (P2 ataca primero).
 * - En caso de empate exacto, se decide al azar (coin flip).
 */
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
function resolveRound(
  p1s: PokemonStats,
  p2s: PokemonStats,
  pt1: string[],
  pt2: string[],
  p1Moves: RealMoveInfo[],
  p2Moves: RealMoveInfo[],
  hp1: number,
  hp2: number,
): { steps: BattleStep[]; hp1: number; hp2: number } {
  const steps: BattleStep[] = [];

  // ── Fase 1: selección simultánea de movimientos ──
  const p1Move = selectBestMove(p1s, pt1, pt2, p2s, p1Moves);
  const p2Move = selectBestMove(p2s, pt2, pt1, p1s, p2Moves);

  // ── Fase 2: determinar orden de ataque por velocidad ──
  const p1First = determineFirstAttacker(p1s.spe, p2s.spe);

  // ── Fase 3: ejecutar en orden ──
  // Construimos la cola de ataques en orden: [primero, segundo]
  interface QueuedAttack {
    move: MoveResult;
    attackerIdx: number;
    offStat: number;
    defStat: number;
    stab: number;
  }

  const queue: QueuedAttack[] = [];

  const q1: QueuedAttack = {
    move: p1Move,
    attackerIdx: 0,
    offStat: p1Move.category === "physical" ? p1s.atk : p1s.spa,
    defStat: p1Move.category === "physical" ? p2s.def : p2s.spd,
    stab: getStabMultiplier(p1Move.type, pt1),
  };

  const q2: QueuedAttack = {
    move: p2Move,
    attackerIdx: 1,
    offStat: p2Move.category === "physical" ? p2s.atk : p2s.spa,
    defStat: p2Move.category === "physical" ? p1s.def : p1s.spd,
    stab: getStabMultiplier(p2Move.type, pt2),
  };

  if (p1First) {
    queue.push(q1, q2);
  } else {
    queue.push(q2, q1);
  }

  for (const attack of queue) {
    if (hp1 <= 0 || hp2 <= 0) break;

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

    const { damage: finalDamage, isCrit } = calculateAttackDamage(
      COMBAT_LEVEL,
      attack.move.power,
      attack.offStat,
      attack.defStat,
      attack.stab,
      attack.move.eff,
    );

    const preHp: [number, number] = [hp1, hp2];

    if (attack.attackerIdx === 0) {
      hp2 = Math.max(0, hp2 - finalDamage);
    } else {
      hp1 = Math.max(0, hp1 - finalDamage);
    }

    const postHp: [number, number] = [hp1, hp2];

    steps.push({
      type: "action",
      attackerIdx: attack.attackerIdx,
      moveName: attack.move.name,
      moveType: attack.move.type,
      category: attack.move.category,
      damage: finalDamage,
      isCrit,
      eff: attack.move.eff,
      preHp,
      postHp,
    });

    // Si el defensor se debilita, registrar faint y cortar la ronda
    if (attack.attackerIdx === 0 && hp2 <= 0) {
      steps.push({ type: "faint", faintedIdx: 1 });
      break;
    }
    if (attack.attackerIdx === 1 && hp1 <= 0) {
      steps.push({ type: "faint", faintedIdx: 0 });
      break;
    }
  }

  return { steps, hp1, hp2 };
}

// GENERAR LA SECUENCIA DE PASOS DE COMBATE
export function generateBattleSteps(
  p1: PokemonDetail,
  p2: PokemonDetail,
  p1s: PokemonStats,
  p2s: PokemonStats,
  maxHp1: number,
  maxHp2: number,
  p1Moves: RealMoveInfo[],
  p2Moves: RealMoveInfo[],
): BattleStep[] {
  const steps: BattleStep[] = [];
  const pt1 = p1.types.map((t) => t.type.name);
  const pt2 = p2.types.map((t) => t.type.name);

  let hp1 = maxHp1;
  let hp2 = maxHp2;

  steps.push({ type: "start" });

  let turn = 1;
  while (hp1 > 0 && hp2 > 0 && turn <= 15) {
    const round = resolveRound(p1s, p2s, pt1, pt2, p1Moves, p2Moves, hp1, hp2);
    steps.push(...round.steps);
    hp1 = round.hp1;
    hp2 = round.hp2;
    turn++;
  }

  const winnerIdx = hp1 > 0 ? 0 : 1;
  steps.push({ type: "end", winnerIdx });

  return steps;
}
