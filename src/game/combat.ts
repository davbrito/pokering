import type { QueryClient } from "@tanstack/react-query";
import type { PokemonDetail } from "../api/pokeapi";
import { moveRetrieveOptions } from "../api/pokeapi/@tanstack/react-query.gen";
import { TYPE_CHART } from "./data";
import type { BattleStep, MoveResult, PokemonStats, RealMoveInfo } from "./types";

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
    // Solo movimientos que causan daño
    if (data.power == null || data.power === 0) return null;
    const dc = data.damage_class?.name;
    if (dc !== "physical" && dc !== "special") return null;
    return {
      name: data.names.find((n) => n.language.name === "es")?.name || data.name,
      type: data.type?.name || "normal",
      category: dc,
      power: data.power,
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
  // Ordenados por poder descendente, top 20
  return valid.sort((a, b) => b.power - a.power).slice(0, 20);
}

// Retorna multiplicador de efectividad acumulado
export function getEffectiveness(attackerType: string, defenderTypes: string[]): number {
  let eff = 1;
  for (const defType of defenderTypes) {
    if (TYPE_CHART[attackerType] && TYPE_CHART[attackerType][defType] !== undefined) {
      eff *= TYPE_CHART[attackerType][defType];
    }
  }
  return eff;
}

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

// Selecciona el mejor movimiento del array de movimientos reales del Pokémon
export function selectBestMove(
  attackerStats: PokemonStats,
  defenderTypes: string[],
  defenderStats: PokemonStats,
  moves: RealMoveInfo[],
): MoveResult {
  let bestMove: MoveResult | null = null;
  let maxDamagePotential = -1;

  for (const move of moves) {
    const offensiveStat = move.category === "physical" ? attackerStats.atk : attackerStats.spa;
    const defensiveStat = move.category === "physical" ? defenderStats.def : defenderStats.spd;

    const typeEff = getEffectiveness(move.type, defenderTypes);
    const expectedDmg = (offensiveStat / defensiveStat) * move.power * typeEff;

    if (expectedDmg > maxDamagePotential) {
      maxDamagePotential = expectedDmg;
      bestMove = {
        name: move.name,
        type: move.type,
        category: move.category,
        power: move.power,
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

      const activeBestMove = selectBestMove(act.atkStats, act.defTypes, act.defStats, act.moves);
      const isPhys = activeBestMove.category === "physical";
      const offVal = isPhys ? act.atkStats.atk : act.atkStats.spa;
      const defVal = isPhys ? act.defStats.def : act.defStats.spd;

      const baseDamage = (((2 * 50) / 5 + 2) * activeBestMove.power * (offVal / defVal)) / 50 + 2;
      const eff = activeBestMove.eff;

      const isCrit = Math.random() < 0.12;
      const critMultiplier = isCrit ? 1.5 : 1;

      const randomMultiplier = 0.85 + Math.random() * 0.15;
      let finalDamage = Math.floor(baseDamage * eff * critMultiplier * randomMultiplier);
      if (finalDamage <= 0 && eff > 0) finalDamage = 1;

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
        eff,
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
