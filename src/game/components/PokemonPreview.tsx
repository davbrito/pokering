import { useQuery } from "@tanstack/react-query";
import { sumBy } from "es-toolkit/math";
import { Volume2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { m } from "#/i18n/paraglide/messages.js";
import { pokemonRetrieveOptions } from "../../api/pokeapi/@tanstack/react-query.gen";
import { getArtworkUrl } from "../api";
import { audioManager, playPokemonCry } from "../audio";
import { PokemonName } from "./PokemonName";
import { StatBars } from "./StatBars";

export function PokemonPreview({ pokemonId, onSelect }: { pokemonId: number | null; onSelect: (id: number) => void }) {
  const { data: pokemon, isLoading: loading } = useQuery({
    ...pokemonRetrieveOptions({ path: { id: String(pokemonId) } }),
    enabled: pokemonId !== null,
  });

  const [isPlaying, setIsPlaying] = useState(false);

  // Precargar el cry en el AudioManager en cuanto se tenga el PokemonDetail
  useEffect(() => {
    if (pokemon) audioManager.preload(pokemon);
  }, [pokemon]);

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
            className={`prev-art ${isPlaying ? "cry-shake" : ""}`}
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
            title={m.pokemon_play_cry()}
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
      <StatBars variant="preview" stats={pokemon.stats.map((s) => ({ name: s.stat.name, base: s.base_stat }))} />
      <button type="button" className="prev-select-btn" onClick={() => onSelect(pokemon.id)}>
        Elegir este ▶
      </button>
    </div>
  );
}
