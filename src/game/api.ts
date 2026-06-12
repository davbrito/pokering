import type { PokemonDetail, PokemonListItem, TypeData } from "./types";

const BASE = "https://pokeapi.co/api/v2";
const SPRITE_BASE =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";

export async function fetchAllPokemon(): Promise<PokemonListItem[]> {
  const r = await fetch(`${BASE}/pokemon?limit=1010`);
  const d = await r.json();
  return d.results.map((p: { name: string; url: string }, i: number) => ({
    name: p.name,
    id: i + 1,
  }));
}

export async function fetchPokemonByName(name: string): Promise<PokemonDetail> {
  const r = await fetch(`${BASE}/pokemon/${name}`);
  const d = await r.json();
  const spR = await fetch(d.species.url);
  const spD = await spR.json();
  const fl =
    spD.flavor_text_entries.find(
      (e: { language: { name: string } }) => e.language.name === "es",
    ) ||
    spD.flavor_text_entries.find(
      (e: { language: { name: string } }) => e.language.name === "en",
    );
  return {
    ...d,
    flavor: fl ? fl.flavor_text.replace(/[\f\n]/g, " ") : "",
  };
}

export async function fetchPokemonById(id: number): Promise<PokemonDetail> {
  const r = await fetch(`${BASE}/pokemon/${id}`);
  return r.json();
}

export async function fetchTypeData(type: string): Promise<PokemonListItem[]> {
  const r = await fetch(`${BASE}/type/${type}`);
  const d: TypeData = await r.json();
  return d.pokemon
    .map((p) => {
      const parts = p.pokemon.url.split("/").filter(Boolean);
      const id = parseInt(parts[parts.length - 1], 10);
      return { name: p.pokemon.name, id };
    })
    .filter((p) => p.id <= 1010)
    .sort((a, b) => a.id - b.id);
}

export function getSpriteUrl(id: number): string {
  return `${SPRITE_BASE}/${id}.png`;
}

export function getArtworkUrl(d: PokemonDetail): string {
  return (
    d.sprites.other?.["official-artwork"]?.front_default ||
    d.sprites.front_default ||
    ""
  );
}
