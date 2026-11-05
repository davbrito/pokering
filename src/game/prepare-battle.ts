import type { QueryClient } from "@tanstack/react-query";
import { pokemonRetrieveOptions } from "../api/pokeapi/@tanstack/react-query.gen";
import type { BattleSetup } from "./battle-state";
import { fetchPokemonMovePool, generateBattleSteps, getStatsObject, scaleStatsArrayByLevel } from "./combat";
import { selectBattleMoves } from "./combat/moves";
import { createRng } from "./rng";
import type { BattleStep } from "./types";

export interface Fighter {
  id: number;
  level: number;
}

export interface PrepareBattleInput {
  queryClient: QueryClient;
  fighters: readonly [Fighter, Fighter];
  seed: number;
}

export interface PreparedBattle {
  setup: BattleSetup;
  steps: BattleStep[];
}

/** Carga datos (async) y genera la batalla completa de forma determinista a partir de `seed`. */
export async function prepareBattle({ queryClient, fighters, seed }: PrepareBattleInput): Promise<PreparedBattle> {
  const [f1, f2] = fighters;
  const [poke1, poke2] = await Promise.all([
    queryClient.ensureQueryData(pokemonRetrieveOptions({ path: { id: String(f1.id) } })),
    queryClient.ensureQueryData(pokemonRetrieveOptions({ path: { id: String(f2.id) } })),
  ]);
  const [pool1, pool2] = await Promise.all([
    fetchPokemonMovePool(queryClient, poke1),
    fetchPokemonMovePool(queryClient, poke2),
  ]);

  const s1 = getStatsObject(poke1);
  const s2 = getStatsObject(poke2);
  const hpOf = (stats: typeof poke1.stats, level: number) =>
    scaleStatsArrayByLevel(stats, level).find((s) => s.stat.name === "hp")?.base_stat ?? 100;
  const mh1 = hpOf(poke1.stats, f1.level);
  const mh2 = hpOf(poke2.stats, f2.level);

  const rng = createRng(seed);
  const m1 = selectBattleMoves(pool1, s1, rng);
  const m2 = selectBattleMoves(pool2, s2, rng);
  const steps = generateBattleSteps(
    poke1,
    poke2,
    s1,
    s2,
    mh1,
    mh2,
    m1,
    m2,
    undefined,
    undefined,
    f1.level,
    f2.level,
    rng,
  );

  return { setup: { maxHp: [mh1, mh2], moves: [m1, m2] }, steps };
}
