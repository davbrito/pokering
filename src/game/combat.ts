import { TYPE_CHART, TYPE_MOVES } from "./data";
import type {
  BattleStep,
  MoveResult,
  PokemonDetail,
  PokemonStats,
} from "./types";

// Retorna multiplicador de efectividad acumulado
export function getEffectiveness(
  attackerType: string,
  defenderTypes: string[],
): number {
  let eff = 1;
  for (const defType of defenderTypes) {
    if (
      TYPE_CHART[attackerType] &&
      TYPE_CHART[attackerType][defType] !== undefined
    ) {
      eff *= TYPE_CHART[attackerType][defType];
    }
  }
  return eff;
}

export function getStatsObject(p: PokemonDetail): PokemonStats {
  const gs = (name: string) =>
    p.stats.find((s) => s.stat.name === name)?.base_stat || 0;
  return {
    hp: gs("hp"),
    atk: gs("attack"),
    def: gs("defense"),
    spa: gs("special-attack"),
    spd: gs("special-defense"),
    spe: gs("speed"),
  };
}

// Selección inteligente del mejor ataque ofensivo
export function selectBestMove(
  attacker: PokemonDetail,
  attackerStats: PokemonStats,
  defenderTypes: string[],
  defenderStats: PokemonStats,
): MoveResult {
  const attackerTypes = attacker.types.map((t) => t.type.name);
  let bestMove: MoveResult | null = null;
  let maxDamagePotential = -1;

  for (const type of attackerTypes) {
    const moveOptions = TYPE_MOVES[type] || TYPE_MOVES.normal;
    const isPhysicalAttacker = attackerStats.atk > attackerStats.spa;
    const category = isPhysicalAttacker ? "physical" : "special";
    const moveName = moveOptions[category];
    const movePower = moveOptions.power;

    const offensiveStat = isPhysicalAttacker
      ? attackerStats.atk
      : attackerStats.spa;
    const defensiveStat = isPhysicalAttacker
      ? defenderStats.def
      : defenderStats.spd;

    const typeEff = getEffectiveness(type, defenderTypes);
    const expectedDmg = (offensiveStat / defensiveStat) * movePower * typeEff;

    if (expectedDmg > maxDamagePotential) {
      maxDamagePotential = expectedDmg;
      bestMove = {
        name: moveName,
        type,
        category,
        power: movePower,
        eff: typeEff,
      };
    }
  }

  return (
    bestMove || {
      name: "Combate",
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

// GENERAR LA SECUENCIA DE PASOS DE COMBATE
export function generateBattleSteps(
  p1: PokemonDetail,
  p2: PokemonDetail,
  p1s: PokemonStats,
  p2s: PokemonStats,
  maxHp1: number,
  maxHp2: number,
): BattleStep[] {
  const steps: BattleStep[] = [];
  const pt1 = p1.types.map((t) => t.type.name);
  const pt2 = p2.types.map((t) => t.type.name);

  let hp1 = maxHp1;
  let hp2 = maxHp2;

  steps.push({
    type: "start",
    text: `¡Comienza el duelo de exhibición! <strong>${p1.name.toUpperCase()}</strong> se enfrenta a <strong>${p2.name.toUpperCase()}</strong> en la arena.`,
  });

  let turn = 1;

  while (hp1 > 0 && hp2 > 0 && turn <= 15) {
    const spd1 = p1s.spe * (0.85 + Math.random() * 0.3);
    const spd2 = p2s.spe * (0.85 + Math.random() * 0.3);

    const firstAttackerP1 = spd1 >= spd2;

    const order: Array<{
      atk: PokemonDetail;
      atkStats: PokemonStats;
      atkTypes: string[];
      def: PokemonDetail;
      defStats: PokemonStats;
      defTypes: string[];
      isAtkP1: boolean;
    }> = firstAttackerP1
      ? [
          {
            atk: p1,
            atkStats: p1s,
            atkTypes: pt1,
            def: p2,
            defStats: p2s,
            defTypes: pt2,
            isAtkP1: true,
          },
        ]
      : [
          {
            atk: p2,
            atkStats: p2s,
            atkTypes: pt2,
            def: p1,
            defStats: p1s,
            defTypes: pt1,
            isAtkP1: false,
          },
        ];

    order.push(
      firstAttackerP1
        ? {
            atk: p2,
            atkStats: p2s,
            atkTypes: pt2,
            def: p1,
            defStats: p1s,
            defTypes: pt1,
            isAtkP1: false,
          }
        : {
            atk: p1,
            atkStats: p1s,
            atkTypes: pt1,
            def: p2,
            defStats: p2s,
            defTypes: pt2,
            isAtkP1: true,
          },
    );

    for (let i = 0; i < order.length; i++) {
      const act = order[i];
      if (hp1 <= 0 || hp2 <= 0) break;

      const activeBestMove = selectBestMove(
        act.atk,
        act.atkStats,
        act.defTypes,
        act.defStats,
      );
      const isPhys = activeBestMove.category === "physical";
      const offVal = isPhys ? act.atkStats.atk : act.atkStats.spa;
      const defVal = isPhys ? act.defStats.def : act.defStats.spd;

      const baseDamage =
        (((2 * 50) / 5 + 2) * activeBestMove.power * (offVal / defVal)) / 50 +
        2;
      const eff = activeBestMove.eff;

      const isCrit = Math.random() < 0.12;
      const critMultiplier = isCrit ? 1.5 : 1;

      const randomMultiplier = 0.85 + Math.random() * 0.15;
      let finalDamage = Math.floor(
        baseDamage * eff * critMultiplier * randomMultiplier,
      );
      if (finalDamage <= 0 && eff > 0) finalDamage = 1;

      const preHp: [number, number] = [hp1, hp2];
      if (act.isAtkP1) {
        hp2 = Math.max(0, hp2 - finalDamage);
      } else {
        hp1 = Math.max(0, hp1 - finalDamage);
      }
      const postHp: [number, number] = [hp1, hp2];

      let msg = `¡<strong>${act.atk.name.toUpperCase()}</strong> usó <span>${activeBestMove.name.toUpperCase()}</span>! `;
      if (isCrit) msg += `<em>¡Impacto Crítico!</em> 💥 `;
      if (eff > 1.5)
        msg += `<span className="super-eff">¡Es súper eficaz!</span> `;
      if (eff < 0.6 && eff > 0) msg += `<span>No es muy eficaz...</span> `;
      if (eff === 0) msg += `<span>¡No le afecta en absoluto!</span> `;

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
        text: msg,
      });

      if (act.isAtkP1 && hp2 <= 0) {
        steps.push({
          type: "faint",
          faintedIdx: 1,
          text: `¡El oponente <strong>${p2.name.toUpperCase()}</strong> se ha desplomado agotado! 😵`,
        });
      } else if (!act.isAtkP1 && hp1 <= 0) {
        steps.push({
          type: "faint",
          faintedIdx: 0,
          text: `¡El luchador <strong>${p1.name.toUpperCase()}</strong> no puede continuar el combate! 😵`,
        });
      }
    }
    turn++;
  }

  const winnerIdx = hp1 > 0 ? 0 : 1;
  const victor = winnerIdx === 0 ? p1 : p2;
  steps.push({
    type: "end",
    winnerIdx,
    text: `🏆 ¡El combate ha terminado! El absoluto ganador de la contienda es <strong>${victor.name.toUpperCase()}</strong>.`,
  });

  return steps;
}
