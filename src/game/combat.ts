import type { QueryClient } from "@tanstack/react-query";
import { random } from "es-toolkit/math";
import type { PokemonDetail } from "../api/pokeapi";
import { moveRetrieveOptions } from "../api/pokeapi/@tanstack/react-query.gen";
import { TYPE_CHART } from "./data";
import type { BattleStep, MoveResult, PokemonStats, RealMoveInfo } from "./types";

/** Nivel fijo al que combaten todos los Pokémon en esta simulación. */
const COMBAT_LEVEL = 50;

function moveIdFromUrl(url: string): string {
  const parts = url.replace(/\/$/, "").split("/");
  return parts[parts.length - 1];
}

async function fetchSingleMove(queryClient: QueryClient, idOrName: string): Promise<RealMoveInfo | null> {
  try {
    const data = await queryClient.ensureQueryData({
      ...moveRetrieveOptions({ path: { id: idOrName } }),
      staleTime: Infinity,
    });
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
  const uniqueIds = [...new Set(pokemon.moves.map((m) => moveIdFromUrl(m.move.url)))];
  const results = await Promise.all(uniqueIds.map((id) => fetchSingleMove(queryClient, id)));
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
  return safeCoinFlip();
}

function safeCoinFlip(): boolean {
  const array = new Uint32Array(1);
  window.crypto.getRandomValues(array);
  return (array[0] & 1) === 0; // Retorna true o false con igual probabilidad
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

  const isCrit = Math.random() < 0.12;
  const critMultiplier = isCrit ? 1.5 : 1;

  const randomMultiplier = 0.85 + Math.random() * 0.15;

  let damage = Math.floor(baseDamage * stab * typeEff * critMultiplier * randomMultiplier);
  if (damage <= 0 && typeEff > 0) damage = 1;

  return { damage, isCrit };
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

  steps.push({
    type: "start",
  });

  let turn = 1;

  while (hp1 > 0 && hp2 > 0 && turn <= 15) {
    const firstAttackerP1 = determineFirstAttacker(p1s.spe, p2s.spe);

    const order: Array<{
      atkStats: PokemonStats;
      defTypes: string[];
      defStats: PokemonStats;
      moves: RealMoveInfo[];
      isAtkP1: boolean;
    }> = firstAttackerP1
      ? [
          {
            atkStats: p1s,
            defTypes: pt2,
            defStats: p2s,
            moves: p1Moves,
            isAtkP1: true,
          },
        ]
      : [
          {
            atkStats: p2s,
            defTypes: pt1,
            defStats: p1s,
            moves: p2Moves,
            isAtkP1: false,
          },
        ];

    order.push(
      firstAttackerP1
        ? {
            atkStats: p2s,
            defTypes: pt1,
            defStats: p1s,
            moves: p2Moves,
            isAtkP1: false,
          }
        : {
            atkStats: p1s,
            defTypes: pt2,
            defStats: p2s,
            moves: p1Moves,
            isAtkP1: true,
          },
    );

    for (let i = 0; i < order.length; i++) {
      const act = order[i];
      if (hp1 <= 0 || hp2 <= 0) break;

      // Los tipos del atacante se pasan para calcular STAB
      const attackerTypes = act.isAtkP1 ? pt1 : pt2;
      const activeBestMove = selectBestMove(act.atkStats, attackerTypes, act.defTypes, act.defStats, act.moves);

      // Chequeo de precisión (accuracy): si el movimiento tiene accuracy
      // definido y el random(1,100) > accuracy, el ataque falla.
      // accuracy null = nunca falla (ej. Swift).
      const acc = activeBestMove.accuracy;
      if (acc !== null && acc < 100 && random(1, 100) > acc) {
        steps.push({
          type: "miss",
          attackerIdx: act.isAtkP1 ? 0 : 1,
          moveName: activeBestMove.name,
        });
        continue;
      }

      // Misma lógica de damage_class: physical → atk/def, special → spa/spd
      const isPhys = activeBestMove.category === "physical";
      const offVal = isPhys ? act.atkStats.atk : act.atkStats.spa;
      const defVal = isPhys ? act.defStats.def : act.defStats.spd;

      const stab = getStabMultiplier(activeBestMove.type, attackerTypes);
      const { damage: finalDamage, isCrit } = calculateAttackDamage(
        COMBAT_LEVEL,
        activeBestMove.power,
        offVal,
        defVal,
        stab,
        activeBestMove.eff,
      );

      const preHp: [number, number] = [hp1, hp2];
      if (act.isAtkP1) {
        hp2 = Math.max(0, hp2 - finalDamage);
      } else {
        hp1 = Math.max(0, hp1 - finalDamage);
      }
      const postHp: [number, number] = [hp1, hp2];

      steps.push({
        type: "action",
        attackerIdx: act.isAtkP1 ? 0 : 1,
        moveName: activeBestMove.name,
        moveType: activeBestMove.type,
        category: activeBestMove.category,
        damage: finalDamage,
        isCrit,
        eff: activeBestMove.eff,
        preHp,
        postHp,
      });

      if (act.isAtkP1 && hp2 <= 0) {
        steps.push({
          type: "faint",
          faintedIdx: 1,
        });
      } else if (!act.isAtkP1 && hp1 <= 0) {
        steps.push({
          type: "faint",
          faintedIdx: 0,
        });
      }
    }
    turn++;
  }

  const winnerIdx = hp1 > 0 ? 0 : 1;
  steps.push({
    type: "end",
    winnerIdx,
  });

  return steps;
}
