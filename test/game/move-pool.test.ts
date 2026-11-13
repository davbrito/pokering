import type { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import type { MoveDetail, PokemonDetail } from "#/api/pokeapi/types.gen.ts";
import { fetchPokemonMovePool } from "#/game/combat.ts";

function moveDetail(name: string): MoveDetail {
  return {
    id: 1,
    name,
    accuracy: 100,
    pp: 35,
    priority: 0,
    power: 40,
    damage_class: { name: "physical" },
    type: { name: "normal" },
    target: { name: "selected-pokemon" },
    meta: {
      ailment: { name: "none" },
      category: { name: "damage" },
      healing: 0,
      drain: 0,
      crit_rate: 0,
    },
    stat_changes: [],
    names: [],
  } as unknown as MoveDetail;
}

const pokemonWith = (...moves: string[]) =>
  ({ moves: moves.map((name) => ({ move: { name } })) }) as unknown as PokemonDetail;

const clientWith = (impl: (name: string) => Promise<MoveDetail | undefined>) =>
  ({
    ensureQueryData: (opts: { queryKey: [{ path: { id: string } }] }) => impl(opts.queryKey[0].path.id),
  }) as unknown as QueryClient;

describe("fetchPokemonMovePool", () => {
  it("returns every move when all requests succeed", async () => {
    const pool = await fetchPokemonMovePool(
      clientWith(async (n) => moveDetail(n)),
      pokemonWith("tackle", "scratch"),
    );
    expect(pool.map((m) => m.name).sort()).toEqual(["scratch", "tackle"]);
  });

  it("skips individual failures when at least one move loads", async () => {
    const pool = await fetchPokemonMovePool(
      clientWith(async (n) => {
        if (n === "scratch") throw new Error("boom");
        return moveDetail(n);
      }),
      pokemonWith("tackle", "scratch"),
    );
    expect(pool.map((m) => m.name)).toEqual(["tackle"]);
  });

  it("propagates the error when every request fails, so the UI can offer a retry", async () => {
    const client = clientWith(async () => {
      throw new Error("network down");
    });
    await expect(fetchPokemonMovePool(client, pokemonWith("tackle", "scratch"))).rejects.toThrow("network down");
  });

  it("returns an empty pool for a Pokémon without moves", async () => {
    const pool = await fetchPokemonMovePool(
      clientWith(async () => undefined),
      pokemonWith(),
    );
    expect(pool).toEqual([]);
  });
});
