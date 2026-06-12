import type { PokemonDetail } from "../api/pokeapi";

const SPRITE_BASE = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";

export function getSpriteUrl(id: number): string {
  return `${SPRITE_BASE}/${id}.png`;
}

export function getArtworkUrl(d: PokemonDetail): string {
  return (d.sprites.other as any)?.["official-artwork"]?.front_default || d.sprites.front_default || "";
}

/** Names array entry from PokemonSpeciesDetail */
export interface SpeciesName {
  language: { name: string; url: string };
  name: string;
}

/** Extract a localized name from a species names array for the given language code.
 *  Falls back to English, then to the first available name, then to the fallback string. */
export function getLocalizedName(names: SpeciesName[] | undefined, langCode: string, fallback: string): string {
  if (!names) return fallback;
  const match = names.find((n) => n.language.name === langCode);
  if (match) return match.name;
  const en = names.find((n) => n.language.name === "en");
  if (en) return en.name;
  return fallback;
}

/** Module-level cache: Pokémon ID → { langCode → name }.
 *  Populated as species data is loaded via the preview panel. */
export const localizedNameCache = new Map<number, Map<string, string>>();
