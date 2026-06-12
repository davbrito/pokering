import type { PokemonDetail } from "../api/pokeapi";

const SPRITE_BASE =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";

export function getSpriteUrl(id: number): string {
  return `${SPRITE_BASE}/${id}.png`;
}

export function getArtworkUrl(d: PokemonDetail): string {
  return (
    (d.sprites.other as any)?.["official-artwork"]?.front_default ||
    d.sprites.front_default ||
    ""
  );
}
