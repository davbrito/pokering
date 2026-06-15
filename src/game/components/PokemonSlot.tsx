import { Dialog } from "@base-ui/react";
import { sumBy } from "es-toolkit/math";
import { CheckIcon, TargetIcon, Volume2 } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import type { PokemonDetail } from "#/api/pokeapi/index.ts";
import { m } from "#/i18n/paraglide/messages.js";
import { getArtworkUrl } from "../api";
import { audioManager, playPokemonCry } from "../audio";
import { scaleStatsArrayByLevel } from "../combat";
import { STAT_ABBR } from "../data";
import { useSettingsStore } from "../settings-store";
import { useChosenPokemon, useGameStore } from "../store";
import { getPokemonName, PokemonName } from "./PokemonName";
import { pickerDialogHandle } from "./pickerDialogHandle";

function PokemonCard({ pokemon, slotIndex }: { pokemon: PokemonDetail; slotIndex: number }) {
  const pokemonLanguage = useSettingsStore((s) => s.pokemonLanguage);
  const level = useGameStore((s) => (slotIndex === 0 ? s.players.player1.level : s.players.player2.level));
  const art = getArtworkUrl(pokemon);
  const types = pokemon.types.map((t) => t.type.name);
  const total = sumBy(pokemon.stats, (s) => s.base_stat);
  const localizedName = getPokemonName(pokemon, pokemonLanguage);
  const [isPlaying, setIsPlaying] = useState(false);

  // Escalar stats base por nivel y aplicar multiplicadores de stages
  const effectiveStats = scaleStatsArrayByLevel(pokemon.stats, level);

  // Precargar el cry en el AudioManager en cuanto se tenga el PokemonDetail
  useEffect(() => {
    audioManager.preload(pokemon);
  }, [pokemon]);

  return (
    <div className="poke-card show">
      <div className="poke-art-wrap relative">
        <img className={`poke-art ${isPlaying ? "cry-shake" : ""}`} src={art} alt={localizedName} />
        <button
          type="button"
          className="poke-cry-btn"
          title="Reproducir grito"
          onClick={(e) => {
            e.stopPropagation();
            playPokemonCry(pokemon, {
              onPlay: () => setIsPlaying(true),
              onEnd: () => setIsPlaying(false),
            });
          }}
        >
          <Volume2 size={14} />
        </button>
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
        {effectiveStats.map((s, i) => {
          const effectiveValue = s.base_stat;
          const rawValue = pokemon.stats[i].base_stat;
          const abbr = STAT_ABBR[s.stat.name] || s.stat.name.slice(0, 3).toUpperCase();
          const pct = Math.round(Math.min((rawValue / 180) * 100, 100));
          const col = pct >= 55 ? "#4ade80" : pct >= 38 ? "#60d8a0" : pct >= 25 ? "#f5c842" : "#e63e3e";
          return (
            <div key={s.stat.name} className="srow">
              <span className="sname">{abbr}</span>
              <div className="strack">
                <motion.div className="sfill" animate={{ width: `${pct}%`, background: col }} />
              </div>
              <span className="sval">{effectiveValue}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PokemonSlot({ index, label }: { index: number; label: string }) {
  const { chosen, chosenLoading } = useChosenPokemon();

  const pokemon = chosen[index];
  const loading = chosenLoading[index];
  const level = useGameStore((s) => (index === 0 ? s.players.player1.level : s.players.player2.level));

  return (
    <div className={`slot${pokemon ? "filled" : ""}`} id={`slot${index}`}>
      <div className="slot-lbl">{label}</div>
      <Dialog.Trigger type="button" className="pick-btn" handle={pickerDialogHandle} payload={{ slot: index }}>
        {!loading && pokemon ? (
          <>
            <span className="pb-icon">
              <CheckIcon size={16} />
            </span>{" "}
            <PokemonName pokemon={pokemon} /> — {m.home_change()}
          </>
        ) : loading ? (
          <div className="spinner" />
        ) : (
          <>
            <span className="pb-icon">
              <TargetIcon size={16} />
            </span>{" "}
            {m.home_select_pokemon()}
          </>
        )}
      </Dialog.Trigger>
      {pokemon && <PokemonCard pokemon={pokemon} slotIndex={index} />}
      {pokemon && (
        <div className="level-row">
          <label className="level-lbl" htmlFor={`level-slider-${index}`}>
            Nv.
          </label>
          <input
            id={`level-slider-${index}`}
            type="range"
            min={1}
            max={100}
            value={level}
            onChange={(e) => useGameStore.getState().setLevel(index, Number(e.target.value))}
            className="level-slider"
          />
          <span className="level-val">{level}</span>
        </div>
      )}
    </div>
  );
}
