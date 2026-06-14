import { useQuery } from "@tanstack/react-query";
import type { PokemonDetail } from "#/api/pokeapi/index.ts";
import { pokemonSpeciesRetrieveOptions } from "../../api/pokeapi/@tanstack/react-query.gen";
import { localizedNameCache } from "../api";
import { useGameStore } from "../store";

/**
 * Resuelve el nombre localizado de un Pokémon desde el caché usando su ID.
 * Si no está en caché, cae de vuelta al fallback.
 */
export function getPokemonNameById(id: number, fallback: string, language: string): string {
  return localizedNameCache.get(id)?.get(language) || fallback;
}

/**
 * Resuelve el nombre localizado de un Pokémon desde el caché.
 * Si no está en caché, cae de vuelta al nombre de la API (inglés).
 */
export function getPokemonName(pokemon: PokemonDetail, language: string): string {
  return getPokemonNameById(pokemon.id, pokemon.name, language);
}

/**
 * Componente que renderiza el nombre localizado de un Pokémon.
 * Usa el idioma actual del store y el caché de nombres localizados.
 */
export function PokemonName({
  pokemon,
  fallback,
}: {
  pokemon: PokemonDetail;
  /** Texto alternativo si no hay datos de Pokémon (ej. "Luchador 1"). */
  fallback?: string;
}) {
  const name = usePokemonName(pokemon, fallback);
  return <span>{name}</span>;
}

export function usePokemonName(pokemon: PokemonDetail | null, fallback?: string): string {
  const speciesName = pokemon?.species.name;
  const pokemonLanguage = useGameStore((s) => s.pokemonLanguage);

  const species = useQuery({
    ...pokemonSpeciesRetrieveOptions({ path: { id: speciesName || "" } }),
    enabled: !!speciesName,
  });

  if (!pokemon) return fallback || "";
  return species.data?.names.find((n) => n.language.name === pokemonLanguage)?.name || pokemon.name;
}
