import { Progress } from "@base-ui/react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { pokemonRetrieveOptions, pokemonSpeciesRetrieveOptions } from "../../api/pokeapi/@tanstack/react-query.gen";
import { getArtworkUrl, getLocalizedName, localizedNameCache } from "../api";
import { STAT_ABBR } from "../data";
import { useGameStore } from "../store";

export function PokemonPreview({ pokemonId, onSelect }: { pokemonId: number | null; onSelect: (id: number) => void }) {
  const pokemonLanguage = useGameStore((s) => s.pokemonLanguage);
  const { data: previewData, isLoading: loading } = useQuery({
    ...pokemonRetrieveOptions({ path: { id: String(pokemonId) } }),
    enabled: pokemonId !== null,
  });

  const speciesName = previewData?.species.name;

  const species = useQuery({
    ...pokemonSpeciesRetrieveOptions({ path: { id: speciesName || "" } }),
    enabled: !!speciesName,
  });

  // Cache localized name when species data loads
  const langCode = pokemonLanguage;
  if (species.data && previewData) {
    const localized = getLocalizedName(species.data.names, langCode, previewData.name);
    let byLang = localizedNameCache.get(previewData.id);
    if (!byLang) {
      byLang = new Map();
      localizedNameCache.set(previewData.id, byLang);
    }
    byLang.set(langCode, localized);
  }

  const localizedName = species.data ? getLocalizedName(species.data.names, langCode, previewData?.name ?? "") : null;

  if (loading || !previewData) {
    return (
      <div className="preview-panel" id="preview-panel">
        {loading ? (
          <div className="loading-bar">
            <div className="spinner" />
          </div>
        ) : (
          <div className="preview-empty">
            <div className="pe-icon">👆</div>
            <div>Pasa el cursor sobre un Pokémon para verlo</div>
          </div>
        )}
      </div>
    );
  }

  const d = previewData;
  const art = getArtworkUrl(d);
  const types = d.types.map((t) => t.type.name);
  const total = d.stats.reduce((a, s) => a + s.base_stat, 0);
  return (
    <div className="preview-panel" id="preview-panel">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.img
          className="prev-art"
          src={art}
          alt={d.name}
          key={art}
          initial={{ opacity: 0, scale: 0.95, x: -40 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0, scale: 0.95, x: 40 }}
          transition={{ ease: "easeInOut", duration: 0.3 }}
        />
        <motion.div
          className="prev-name origin-[bottom_center] leading-none"
          key={localizedName || d.name}
          initial={{ rotateX: 90, opacity: 0, scale: 1 }}
          animate={{ rotateX: 0, opacity: 1, scale: 1 }}
          exit={{ rotateX: -90, opacity: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 25 }}
        >
          {localizedName || d.name}
        </motion.div>
      </AnimatePresence>
      <div className="prev-subname">{d.name}</div>
      <div className="prev-meta">
        #{String(d.id).padStart(3, "0")} · BST {total}
      </div>
      <div className="prev-types">
        {types.map((t) => (
          <span key={t} className={`tbadge t-${t}`}>
            {t}
          </span>
        ))}
      </div>
      <div className="prev-stats">
        {d.stats.map((s) => {
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
                  style={{ width: `${pct}%`, background: col, transition: "initial" }}
                  render={<motion.div />}
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
      <button type="button" className="prev-select-btn" onClick={() => onSelect(d.id)}>
        Elegir este ▶
      </button>
    </div>
  );
}
