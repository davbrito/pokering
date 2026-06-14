import { Dialog } from "@base-ui/react";
import type { PokemonDetail } from "#/api/pokeapi/index.ts";
import { m } from "#/i18n/paraglide/messages.js";
import { getArtworkUrl } from "../api";
import { getStatsObject } from "../combat";
import { STAT_ABBR } from "../data";
import { useChosenPokemon, useGameStore } from "../store";
import { getPokemonName, PokemonName } from "./PokemonName";
import { pickerDialogHandle } from "./pickerDialogHandle";

function PokemonCard({ pokemon }: { pokemon: PokemonDetail }) {
  const pokemonLanguage = useGameStore((s) => s.pokemonLanguage);
  const art = getArtworkUrl(pokemon);
  const types = pokemon.types.map((t) => t.type.name);
  const stats = getStatsObject(pokemon);
  const total = Object.values(stats).reduce((a, b) => a + b, 0);
  const localizedName = getPokemonName(pokemon, pokemonLanguage);

  return (
    <div className="poke-card show">
      <div className="poke-art-wrap">
        <img className="poke-art" src={art} alt={localizedName} />
      </div>
      <div className="poke-name">
        <PokemonName pokemon={pokemon} />
      </div>
      <div className="poke-sub">
        #{String(pokemon.id).padStart(3, "0")} · {pokemon.height! / 10}m · {pokemon.weight! / 10}
        kg · BST {total}
      </div>
      <div className="types">
        {types.map((t) => (
          <span key={t} className={`tbadge t-${t}`}>
            {t}
          </span>
        ))}
      </div>
      <div className="stats">
        {pokemon.stats.map((s) => {
          const abbr = STAT_ABBR[s.stat.name] || s.stat.name.slice(0, 3).toUpperCase();
          const pct = Math.round(Math.min((s.base_stat / 180) * 100, 100));
          const col =
            s.base_stat >= 100 ? "#4ade80" : s.base_stat >= 70 ? "#60d8a0" : s.base_stat >= 45 ? "#f5c842" : "#e63e3e";
          return (
            <div key={s.stat.name} className="srow">
              <span className="sname">{abbr}</span>
              <div className="strack">
                <div className="sfill" style={{ width: `${pct}%`, background: col }} />
              </div>
              <span className="sval">{s.base_stat}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PokemonSlot({ index, label }: { index: number; label: string }) {
  const { chosen, chosenLoading } = useChosenPokemon();
  const pokemonLanguage = useGameStore((s) => s.pokemonLanguage);

  const pokemon = chosen[index];
  const loading = chosenLoading[index];
  const displayName = pokemon ? getPokemonName(pokemon, pokemonLanguage) : "";

  return (
    <div className={`slot${pokemon ? "filled" : ""}`} id={`slot${index}`}>
      <div className="slot-lbl">{label}</div>
      <Dialog.Trigger type="button" className="pick-btn" handle={pickerDialogHandle} payload={{ slot: index }}>
        {!loading && pokemon ? (
          <>
            <span className="pb-icon">✔</span> {displayName} — {m.home_change()}
          </>
        ) : loading ? (
          <div className="spinner" />
        ) : (
          <>
            <span className="pb-icon">⊕</span> {m.home_select_pokemon()}
          </>
        )}
      </Dialog.Trigger>
      {pokemon && <PokemonCard pokemon={pokemon} />}
    </div>
  );
}
