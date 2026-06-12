import { Dialog } from "@base-ui/react/dialog";
import { useDebouncedValue } from "@tanstack/react-pacer";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";
import {
  pokemonListOptions,
  pokemonRetrieveOptions,
  pokemonSpeciesRetrieveOptions,
  typeRetrieveOptions,
} from "../../api/pokeapi/@tanstack/react-query.gen";
import { getArtworkUrl, getLocalizedName, getSpriteUrl, localizedNameCache } from "../api";
import { STAT_ABBR, TYPE_TAB_COLORS, TYPES } from "../data";
import { useGameStore } from "../store";

export const pickerDialogHandle = Dialog.createHandle<{ slot: number }>();

function PokemonPreview({ pokemonId, onSelect }: { pokemonId: number | null; onSelect: (id: number) => void }) {
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

export function PokemonModal() {
  const open = pickerDialogHandle.store.useState("open");

  return (
    <Dialog.Root handle={pickerDialogHandle}>
      {({ payload }) => (
        <AnimatePresence>
          {open && (
            <Dialog.Portal key="modal-portal" keepMounted>
              <Dialog.Backdrop
                className="modal-overlay"
                render={
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  />
                }
              />
              <Dialog.Popup
                className="modal"
                render={
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    transition={{ duration: 0.2 }}
                  />
                }
              >
                <DialogContent slot={payload?.slot} />
              </Dialog.Popup>
            </Dialog.Portal>
          )}
        </AnimatePresence>
      )}
    </Dialog.Root>
  );
}

function getIdFromUrl(url: string): number {
  const parts = url.split("/").filter(Boolean);
  return parseInt(parts[parts.length - 1], 10);
}

function DialogContent({ slot = 0 }: { slot: number | undefined }) {
  const searchQuery = useGameStore((s) => s.searchQuery);
  const activeTab = useGameStore((s) => s.activeTab);
  const pokemonLanguage = useGameStore((s) => s.pokemonLanguage);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 120;

  const queryClient = useQueryClient();

  // Debounced search for client-side filtering
  const [debouncedSearch] = useDebouncedValue(searchQuery, { wait: 300 });
  const isSearching = debouncedSearch.trim().length > 0;

  // Reset page when search or tab changes
  const prevSearchRef = useRef(searchQuery);
  const prevTabRef = useRef(activeTab);
  if (prevSearchRef.current !== searchQuery || prevTabRef.current !== activeTab) {
    setPage(1);
    prevSearchRef.current = searchQuery;
    prevTabRef.current = activeTab;
  }

  // ── "All" tab ──
  // Without search: server-side pagination (limit + offset)
  // With search:    fetch all 1010, filter client-side
  const listQuery = useQuery({
    ...pokemonListOptions({
      query: isSearching ? { limit: 1010 } : { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE },
    }),
    staleTime: 5 * 60 * 1000,
  });
  const listCount = listQuery.data?.count ?? 0;
  const allListItems = listQuery.data?.results?.map((p) => ({
    name: p.name,
    id: getIdFromUrl(p.url),
  }));
  const listItems = (() => {
    if (!allListItems) return undefined;
    if (!isSearching) return allListItems;
    const q = debouncedSearch.toLowerCase().trim();
    return allListItems.filter((p) => {
      const cached = localizedNameCache.get(p.id);
      const localized = cached?.get(pokemonLanguage);
      const name = (localized || p.name).toLowerCase();
      return name.includes(q) || String(p.id).padStart(3, "0").includes(q);
    });
  })();

  // ── Type tab: fetch all, paginate + search client-side ──
  const typeQuery = useQuery({
    ...typeRetrieveOptions({ path: { id: activeTab } }),
    enabled: activeTab !== "all",
  });
  const typeItemsRaw = typeQuery.data?.pokemon.map((p) => ({
    name: p.pokemon!.name ?? "",
    id: getIdFromUrl(p.pokemon!.url ?? ""),
  }));
  const typeItems = (() => {
    if (!typeItemsRaw) return undefined;
    if (!isSearching) return typeItemsRaw;
    const q = debouncedSearch.toLowerCase().trim();
    return typeItemsRaw.filter((p) => {
      const cached = localizedNameCache.get(p.id);
      const localized = cached?.get(pokemonLanguage);
      const name = (localized || p.name).toLowerCase();
      return name.includes(q) || String(p.id).padStart(3, "0").includes(q);
    });
  })();
  const typeCount = typeItems?.length ?? 0;

  // ── Resolve current list and pagination ──
  // "All" tab uses server pagination; type tab uses client pagination
  const currentList = activeTab !== "all" ? typeItems : listItems;
  const totalCount = activeTab !== "all" ? typeCount : isSearching ? (listItems?.length ?? 0) : listCount;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);

  const pageItems =
    activeTab === "all" && !isSearching
      ? (currentList ?? [])
      : (currentList ?? []).slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  const isLoading = activeTab === "all" ? listQuery.isFetching : typeQuery.isFetching;

  const handleSelect = (id: number) => {
    useGameStore.getState().selectPokemon(slot, id);
    pickerDialogHandle.close();
  };

  return (
    <>
      <div className="modal-head">
        <input
          className="modal-search"
          id="modal-search"
          type="text"
          placeholder="Buscar por nombre o número..."
          value={searchQuery}
          onChange={(e) => useGameStore.getState().setSearchQuery(e.currentTarget.value)}
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
              className={`tab-btn ${activeTab === t ? "active" : ""}`}
              style={{
                background: c.bg,
                color: c.color,
                borderColor: c.border,
              }}
              onClick={() => useGameStore.getState().setActiveTab(t)}
            >
              {t === "all" ? "Todos" : t}
            </button>
          );
        })}
      </div>
      <div className="modal-body">
        <div className="poke-grid-wrap">
          {isLoading && (!currentList || currentList.length === 0) ? (
            <div className="poke-grid-loading">
              <div className="spinner" />
              <span>Cargando Pokémon…</span>
            </div>
          ) : currentList && currentList.length > 0 ? (
            <div className="poke-grid-container">
              {isLoading && (
                <div className="poke-grid-overlay">
                  <div className="spinner" />
                </div>
              )}
              <div className="poke-grid" id="poke-grid">
                {pageItems.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="poke-thumb"
                    onClick={() => handleSelect(p.id)}
                    onMouseEnter={() => {
                      queryClient
                        .ensureQueryData(pokemonRetrieveOptions({ path: { id: String(p.id) } }))
                        .then((data) => {
                          queryClient.prefetchQuery(pokemonSpeciesRetrieveOptions({ path: { id: data.species.name } }));
                        })
                        .catch(() => {
                          /* ignore prefetch errors */
                        });
                      setHoveredId(p.id);
                    }}
                  >
                    <img src={getSpriteUrl(p.id)} alt={p.name} loading="lazy" className="select-none" />
                    <div className="pt-name">{localizedNameCache.get(p.id)?.get(pokemonLanguage) || p.name}</div>
                    <div className="pt-num">#{String(p.id).padStart(3, "0")}</div>
                  </button>
                ))}
              </div>
              {totalPages > 1 && (
                <div className="pagination">
                  <span className="page-info">
                    Pág. {clampedPage} de {totalPages}
                  </span>
                  <div className="page-arrows">
                    <button
                      type="button"
                      className="page-btn"
                      disabled={clampedPage <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      aria-label="Página anterior"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      type="button"
                      className="page-btn"
                      disabled={clampedPage >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      aria-label="Página siguiente"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
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
