import { Dialog } from "@base-ui/react/dialog";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  pokemonListOptions,
  pokemonRetrieveOptions,
  typeRetrieveOptions,
} from "../../api/pokeapi/@tanstack/react-query.gen";
import { getArtworkUrl, getSpriteUrl } from "../api";
import { STAT_ABBR, TYPE_TAB_COLORS, TYPES } from "../data";
import { useGame, useGameActions } from "../store";

export const pickerDialogHandle = Dialog.createHandle<{ slot: number }>();

function PokemonPreview({ pokemonId, onSelect }: { pokemonId: number | null; onSelect: (id: number) => void }) {
  const { data: previewData, isLoading: loading } = useQuery({
    ...pokemonRetrieveOptions({ path: { id: String(pokemonId) } }),
    enabled: pokemonId !== null,
    staleTime: Infinity,
  });

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
            const abbr = STAT_ABBR[s.stat.name] || s.stat.name.slice(0, 3).toUpperCase();
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
  return (
    <Dialog.Root handle={pickerDialogHandle}>
      {({ payload }) => (
        <Dialog.Portal>
          <Dialog.Backdrop className="modal-overlay" />
          <Dialog.Popup className="modal">
            <DialogContent slot={payload?.slot} />
          </Dialog.Popup>
        </Dialog.Portal>
      )}
    </Dialog.Root>
  );
}

function getIdFromUrl(url: string): number {
  const parts = url.split("/").filter(Boolean);
  return parseInt(parts[parts.length - 1], 10);
}

function DialogContent({ slot = 0 }: { slot: number | undefined }) {
  const state = useGame();
  const actions = useGameActions();
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const listQuery = useQuery({
    ...pokemonListOptions({ query: { limit: 1010 } }),
    staleTime: 5 * 60 * 1000,
    select: (data) => data.results,
  });
  const allPokemon = listQuery.data?.map((p) => ({
    name: p.name,
    id: getIdFromUrl(p.url),
  }));

  const typeQuery = useQuery({
    ...typeRetrieveOptions({ path: { id: state.activeTab } }),
    enabled: state.activeTab !== "all",
  });
  const typeData = typeQuery.data?.pokemon.map((p) => ({
    name: p.pokemon!.name,
    id: getIdFromUrl(p.pokemon!.url!),
  }));

  const handleSelect = (id: number) => {
    actions.selectPokemon(slot, id);
    pickerDialogHandle.close();
  };

  const filteredList = (() => {
    const tab = state.activeTab;
    const q = state.searchQuery.toLowerCase().trim();
    let list = tab === "all" ? allPokemon : typeData;
    if (!list) return [];
    if (!list.length && tab === "all") return [];
    if (q) {
      list = allPokemon?.filter((p) => p.name.includes(q) || String(p.id).padStart(3, "0").includes(q));
    }
    return list ?? [];
  })();

  return (
    <>
      <div className="modal-head">
        <input
          className="modal-search"
          id="modal-search"
          type="text"
          placeholder="Buscar por nombre o número..."
          value={state.searchQuery}
          onChange={(e) => actions.setSearchQuery(e.currentTarget.value)}
        />
        <Dialog.Close className="modal-close">✕</Dialog.Close>
      </div>

      <div className="tabs-bar" id="tabs-bar">
        {TYPES.map((t) => {
          const c = TYPE_TAB_COLORS[t] || TYPE_TAB_COLORS.normal;
          return (
            <button
              key={t}
              type="button"
              className={`tab-btn ${state.activeTab === t ? "active" : ""}`}
              style={{
                background: c.bg,
                color: c.color,
                borderColor: c.border,
              }}
              onClick={() => actions.setActiveTab(t)}
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
                  onClick={() => handleSelect(p.id)}
                  onMouseEnter={() => setHoveredId(p.id)}
                >
                  <img src={getSpriteUrl(p.id)} alt={p.name} loading="lazy" className="select-none" />
                  <div className="pt-name">{p.name}</div>
                  <div className="pt-num">#{String(p.id).padStart(3, "0")}</div>
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
    </>
  );
}
