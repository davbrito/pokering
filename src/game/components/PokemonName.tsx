import { useQuery } from "@tanstack/react-query";
import type { PokemonDetail } from "#/api/pokeapi/index.ts";
import { pokemonSpeciesRetrieveOptions } from "../../api/pokeapi/@tanstack/react-query.gen";
import { useSettingsStore } from "../settings-store";

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
  const pokemonLanguage = useSettingsStore((s) => s.pokemonLanguage);

  const species = useQuery({
    ...pokemonSpeciesRetrieveOptions({ path: { id: speciesName || "" } }),
    enabled: !!speciesName,
  });

  if (!pokemon) return fallback || "";
  return species.data?.names.find((n) => n.language.name === pokemonLanguage)?.name || pokemon.name;
}
