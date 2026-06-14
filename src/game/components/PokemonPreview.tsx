import { Progress } from "@base-ui/react";
import { useQuery } from "@tanstack/react-query";
import { sumBy } from "es-toolkit/math";
import { Volume2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { m } from "#/i18n/paraglide/messages.js";
import { pokemonRetrieveOptions } from "../../api/pokeapi/@tanstack/react-query.gen";
import { getArtworkUrl } from "../api";
import { playPokemonCry } from "../audio";
import { STAT_ABBR } from "../data";
import { PokemonName } from "./PokemonName";

export function PokemonPreview({ pokemonId, onSelect }: { pokemonId: number | null; onSelect: (id: number) => void }) {
  const { data: pokemon, isLoading: loading } = useQuery({
    ...pokemonRetrieveOptions({ path: { id: String(pokemonId) } }),
    enabled: pokemonId !== null,
  });

  if (loading || !pokemon) {
    return (
      <div className="preview-panel" id="preview-panel">
        {loading ? (
          <div className="loading-bar">
            <div className="spinner" />
          </div>
        ) : (
          <div className="preview-empty">
            <div className="pe-icon">👆</div>
            <div>{m.preview_hover_hint()}</div>
          </div>
        )}
      </div>
    );
  }

  const art = getArtworkUrl(pokemon);
  const types = pokemon.types.map((t) => t.type.name);
  const total = sumBy(pokemon.stats, (s) => s.base_stat);

  return (
    <div className="preview-panel" id="preview-panel">
      <AnimatePresence mode="popLayout" initial={false}>
        <div className="relative">
          <motion.img
            className="prev-art"
            src={art}
            alt={pokemon.name}
            key={art}
            initial={{ opacity: 0, scale: 0.95, x: -40 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.95, x: 40 }}
            transition={{ ease: "easeInOut", duration: 0.3 }}
          />
          <button
            type="button"
            className="prev-cry-btn"
            title="Reproducir grito"
            onClick={(e) => {
              e.stopPropagation();
              playPokemonCry(pokemon);
            }}
          >
            <Volume2 size={14} />
          </button>
        </div>
        <motion.div
          className="prev-name origin-[bottom_center] leading-none"
          key={pokemon.name}
          initial={{ rotateX: 90, opacity: 0, scale: 1 }}
          animate={{ rotateX: 0, opacity: 1, scale: 1 }}
          exit={{ rotateX: -90, opacity: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 25 }}
        >
          <PokemonName pokemon={pokemon} />
        </motion.div>
      </AnimatePresence>
      <div className="prev-subname">{pokemon.name}</div>
      <div className="prev-meta">
        #{String(pokemon.id).padStart(3, "0")} · BST {total}
      </div>
      <div className="prev-types">
        {types.map((t) => (
          <span key={t} className={`tbadge t-${t}`}>
            {t}
          </span>
        ))}
      </div>
      <div className="prev-stats">
        {pokemon.stats.map((s) => {
          const abbr = STAT_ABBR[s.stat.name] || s.stat.name.slice(0, 3).toUpperCase();
          const pct = Math.round(Math.min((s.base_stat / 180) * 100, 100));
          const col =
            s.base_stat >= 100 ? "#4ade80" : s.base_stat >= 70 ? "#60d8a0" : s.base_stat >= 45 ? "#f5c842" : "#e63e3e";
          return (
            <Progress.Root key={s.stat.name} className="prev-srow" value={s.base_stat} max={180}>
              <span className="prev-sname">{abbr}</span>
              <Progress.Track className="strack">
                <Progress.Indicator
                  className="sfill"
                  render={<motion.div animate={{ width: `${pct}%`, background: col }} />}
                />
              </Progress.Track>
              <Progress.Value
                className="font-mono text-text"
                style={{
                  fontSize: "9px",
                }}
              >
                {(_fmt, value) => value}
              </Progress.Value>
            </Progress.Root>
          );
        })}
      </div>
      <button type="button" className="prev-select-btn" onClick={() => onSelect(pokemon.id)}>
        Elegir este ▶
      </button>
    </div>
  );
}
