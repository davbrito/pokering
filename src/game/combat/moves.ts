import { random } from "es-toolkit/math";
import { TYPE_CHART } from "../data";
import { randomProbability } from "../random";
import type { AilmentState, MoveInfo, PokemonStats, StatStages } from "../types";

/** Movimiento de fallback cuando un Pokémon no tiene movimientos válidos. */
export const struggleMove: MoveInfo = {
  damageClass: "physical",
  name: "struggle",
  type: "normal",
  accuracy: null,
  pp: 0,
  power: 50,
};

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

/**
 * Aplica la estrategia de 4 slots: pule un pool de movimientos a exactamente 4,
 * escogiendo estratégicamente según las estadísticas del Pokémon.
 *
 *   - Ruleta competitiva: elige al azar entre el Top 3 de ataques de cada categoría.
 *   - Sesgo por estadísticas: si ATK > SpA × 1.5, privilegia 2 físicos;
 *     si SpA > ATK × 1.5, privilegia 2 especiales.
 *   - Slot 3: Primer stat-change o heal (net-good-stats/heal)
 *   - Slot 4: Primer ailment
 *
 * @param pool  Pool completo de movimientos válidos.
 * @param stats Estadísticas base del Pokémon (opcional, para sesgo).
 */
export function selectBattleMoves(pool: MoveInfo[], stats?: PokemonStats): MoveInfo[] {
  // Ponderación estocástica: pequeño ruido (±5) al comparar poder para que
  // movimientos con potencia similar puedan reordenarse aleatoriamente.
  const noisySort = (a: MoveInfo, b: MoveInfo) => (b.power ?? 0) + random(-5, 5) - ((a.power ?? 0) + random(-5, 5));

  const physical = pool.filter((m) => m.damageClass === "physical").sort(noisySort);
  const special = pool.filter((m) => m.damageClass === "special").sort(noisySort);
  const stat = pool.find(
    (m) => m.damageClass === "status" && (m.effect.kind === "stat-change" || m.effect.kind === "heal"),
  );
  const ailment = pool.find((m) => m.damageClass === "status" && m.effect.kind === "ailment");

  const result: MoveInfo[] = [];

  // ── Determinar sesgo físico/especial ──
  // Si una estadística ofensiva supera a la otra por ≥ 50 %, duplicamos esa categoría.
  const atk = stats?.atk ?? 0;
  const spa = stats?.spa ?? 0;
  const biasPhysical = atk > 0 && spa > 0 && atk >= spa * 1.5;
  const biasSpecial = spa > 0 && atk > 0 && spa >= atk * 1.5;

  // ── Ruleta competitiva: elegir al azar del Top 3 ──
  const pickTop = (arr: MoveInfo[]): MoveInfo | undefined => {
    if (arr.length === 0) return undefined;
    const top = arr.slice(0, Math.min(3, arr.length));
    return top[Math.floor(random(0, top.length))];
  };

  if (biasPhysical) {
    // Dos ataques físicos + 0 especiales
    const p1 = pickTop(physical);
    if (p1) {
      result.push(p1);
      const remaining = physical.filter((m) => m.name !== p1.name);
      const p2 = pickTop(remaining);
      if (p2) result.push(p2);
    }
  } else if (biasSpecial) {
    // Dos ataques especiales + 0 físicos
    const s1 = pickTop(special);
    if (s1) {
      result.push(s1);
      const remaining = special.filter((m) => m.name !== s1.name);
      const s2 = pickTop(remaining);
      if (s2) result.push(s2);
    }
  } else {
    // Balanceado: 1 físico + 1 especial
    const p = pickTop(physical);
    if (p) result.push(p);
    const s = pickTop(special);
    if (s) result.push(s);
  }

  if (stat) result.push(stat);
  if (ailment) result.push(ailment);

  return result;
}

// STAB (Same Type Attack Bonus): si el tipo del movimiento coincide
// con uno de los tipos del atacante, el daño se multiplica por 1.5.
export function getStabMultiplier(moveType: string, attackerTypes: string[]): number {
  return attackerTypes.includes(moveType) ? 1.5 : 1;
} // Retorna multiplicador de efectividad acumulado

export function getEffectiveness(attackerType: string, defenderTypes: string[]): number {
  const attackerChart = TYPE_CHART[attackerType];
  if (!attackerChart) return 1; // Si el tipo atacante no está en la tabla, se asume efectividad normal
  return defenderTypes
    .values()
    .filter((defType) => attackerChart[defType] !== undefined)
    .reduce((eff, defType) => eff * attackerChart[defType], 1);
}
