import { useEffect, useRef, useState } from "react";
import { fetchPokemonById, getArtworkUrl, getSpriteUrl } from "../api";
import { STAT_ABBR, TYPE_TAB_COLORS, TYPES } from "../data";
import { useGame, useGameActions } from "../store";
import type { PokemonDetail } from "../types";

function PokemonPreview({
  pokemonId,
  onSelect,
}: {
  pokemonId: number | null;
  onSelect: (name: string) => void;
}) {
  const [previewData, setPreviewData] = useState<PokemonDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const lastFetched = useRef(0);

  useEffect(() => {
    if (pokemonId === null || pokemonId === lastFetched.current) return;
    lastFetched.current = pokemonId;
    setLoading(true);
    setPreviewData(null);
    fetchPokemonById(pokemonId)
      .then(setPreviewData)
      .catch(() => setPreviewData(null))
      .finally(() => setLoading(false));
  }, [pokemonId]);

  if (!loading && previewData) {
    const d = previewData;
    const art = getArtworkUrl(d);
    const types = d.types.map((t) => t.type.name);
    const total = d.stats.reduce((a, s) => a + s.base_stat, 0);
    return (
      <div className="preview-panel" id="preview-panel">
        <img className="prev-art" src={art} alt={d.name} />
        <div className="prev-name">{d.name}</div>
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
            const abbr =
              STAT_ABBR[s.stat.name] || s.stat.name.slice(0, 3).toUpperCase();
            const pct = Math.round(Math.min((s.base_stat / 180) * 100, 100));
            const col =
              s.base_stat >= 100
                ? "#4ade80"
                : s.base_stat >= 70
                  ? "#60d8a0"
                  : s.base_stat >= 45
                    ? "#f5c842"
                    : "#e63e3e";
            return (
              <div key={s.stat.name} className="prev-srow">
                <span className="prev-sname">{abbr}</span>
                <div className="strack">
                  <div
                    className="sfill"
                    style={{ width: `${pct}%`, background: col }}
                  />
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
        <button
          type="button"
          className="prev-select-btn"
          onClick={() => onSelect(d.name)}
        >
          Elegir este ▶
        </button>
      </div>
    );
  }

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

export function PokemonModal() {
  const state = useGame();
  const actions = useGameActions();
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") actions.setModalOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [actions]);

  const handleSelect = (name: string) => {
    actions.selectPokemon(state.activeSlot, name);
    actions.setModalOpen(false);
  };

  const filteredList = (() => {
    const tab = state.activeTab;
    const q = state.searchQuery.toLowerCase().trim();
    let list = tab === "all" ? state.allPokemon : state.typePokemon;
    if (!list.length && tab === "all") return [];
    if (q) {
      list = state.allPokemon.filter(
        (p) => p.name.includes(q) || String(p.id).padStart(3, "0").includes(q),
      );
    }
    return list;
  })();

  const switchTabHandler = async (type: string) => {
    actions.setActiveTab(type);
    if (type !== "all") {
      const data = await actions.loadTypeData(type);
      actions.setTypePokemon(data);
    }
  };

  return (
    <div className={`modal-overlay${state.modalOpen ? " open" : ""}`}>
      {state.modalOpen && (
        <button
          type="button"
          className="modal-overlay-bg"
          aria-label="Cerrar modal"
          onClick={() => actions.setModalOpen(false)}
        />
      )}
      <div className="modal">
        <div className="modal-head">
          <input
            className="modal-search"
            id="modal-search"
            type="text"
            placeholder="Buscar por nombre o número..."
            value={state.searchQuery}
            onChange={(e) => actions.setSearchQuery(e.currentTarget.value)}
          />
          <button
            type="button"
            className="modal-close"
            onClick={() => actions.setModalOpen(false)}
          >
            ✕
          </button>
        </div>

        <div className="tabs-bar" id="tabs-bar">
          {TYPES.map((t) => {
            const c = TYPE_TAB_COLORS[t] || TYPE_TAB_COLORS.normal;
            return (
              <button
                key={t}
                type="button"
                className={`tab-btn${state.activeTab === t ? " active" : ""}`}
                style={{
                  background: c.bg,
                  color: c.color,
                  borderColor: c.border,
                }}
                onClick={() => switchTabHandler(t)}
              >
                {t === "all" ? "Todos" : t}
              </button>
            );
          })}
        </div>

        <div className="modal-body">
          <div className="poke-grid-wrap">
            {filteredList.length > 0 ? (
              <div className="poke-grid" id="poke-grid">
                {filteredList.slice(0, 200).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="poke-thumb"
                    onClick={() => handleSelect(p.name)}
                    onMouseEnter={() => setHoveredId(p.id)}
                  >
                    <img src={getSpriteUrl(p.id)} alt={p.name} loading="lazy" />
                    <div className="pt-name">{p.name}</div>
                    <div className="pt-num">
                      #{String(p.id).padStart(3, "0")}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="no-results" style={{ gridColumn: "1/-1" }}>
                No se encontraron Pokémon
              </div>
            )}
          </div>
          <PokemonPreview pokemonId={hoveredId} onSelect={handleSelect} />
        </div>
      </div>
    </div>
  );
}
