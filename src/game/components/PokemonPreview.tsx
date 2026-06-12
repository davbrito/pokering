import { useQuery } from "@tanstack/react-query";
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
      <img className="prev-art" src={art} alt={d.name} />
      <div className="prev-name">{localizedName || d.name}</div>
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
            <div key={s.stat.name} className="prev-srow">
              <span className="prev-sname">{abbr}</span>
              <div className="strack">
                <div className="sfill" style={{ width: `${pct}%`, background: col }} />
              </div>
              <span
                style={{
                  fontSize: "9px",
                  fontFamily: "var(--font-m)",
                  color: "var(--text)",
                }}
              >
                {s.base_stat}
              </span>
            </div>
          );
        })}
      </div>
      <button type="button" className="prev-select-btn" onClick={() => onSelect(d.id)}>
        Elegir este ▶
      </button>
    </div>
  );
}
