import { Toggle, ToggleGroup } from "@base-ui/react";
import { Dialog } from "@base-ui/react/dialog";
import { useDebouncedCallback, useDebouncedValue } from "@tanstack/react-pacer";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { XIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useDeferredValue, useState } from "react";
import { m } from "#/i18n/paraglide/messages.js";
import {
  pokemonListInfiniteOptions,
  pokemonRetrieveOptions,
  pokemonSpeciesRetrieveOptions,
  typeListOptions,
  typeRetrieveOptions,
} from "../../api/pokeapi/@tanstack/react-query.gen";
import { cn } from "../../lib/utils";
import { getSpriteUrl, localizedNameCache } from "../api";
import { getTypeSpriteUrl, TYPE_TAB_COLORS } from "../data";
import { useGameStore } from "../store";
import { PokemonPreview } from "./PokemonPreview";
import { pickerDialogHandle } from "./pickerDialogHandle";

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
  const deferredHoveredId = useDeferredValue(hoveredId);
  const PAGE_SIZE = 120;

  const queryClient = useQueryClient();

  // Debounced search for client-side filtering
  const [debouncedSearch] = useDebouncedValue(searchQuery, { wait: 300 });
  const isSearching = debouncedSearch.trim().length > 0;

  // ── "All" tab: infinite query (carga progresiva) ──
  const listInfinite = useInfiniteQuery({
    ...pokemonListInfiniteOptions({ query: { limit: PAGE_SIZE } }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      if (!lastPage.next) return undefined;
      const url = new URL(lastPage.next);
      const offset = parseInt(url.searchParams.get("offset") || "0", 10);
      return offset;
    },
  });

  const allAccumulatedItems = listInfinite.data?.pages.flatMap((p) =>
    p.results.map((r) => ({
      name: r.name,
      id: getIdFromUrl(r.url),
    })),
  );

  const filteredAllItems = (() => {
    if (!allAccumulatedItems) return undefined;
    if (!isSearching) return allAccumulatedItems;
    const q = debouncedSearch.toLowerCase().trim();
    return allAccumulatedItems.filter((p) => {
      const cached = localizedNameCache.get(p.id);
      const localized = cached?.get(pokemonLanguage);
      const name = (localized || p.name).toLowerCase();
      return name.includes(q) || String(p.id).padStart(3, "0").includes(q);
    });
  })();

  // ── Type tab: fetch all, filter client-side ──
  const typeQuery = useQuery({
    ...typeRetrieveOptions({ path: { id: activeTab } }),
    enabled: activeTab !== "all",
  });
  const typeItemsRaw = typeQuery.data?.pokemon.map((p) => ({
    name: p.pokemon!.name ?? "",
    id: getIdFromUrl(p.pokemon!.url ?? ""),
  }));
  const filteredTypeItems = (() => {
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

  // ── Resolve current list ──
  const currentList = activeTab !== "all" ? filteredTypeItems : filteredAllItems;
  const isInitialLoading = activeTab === "all" ? listInfinite.isLoading : typeQuery.isLoading;
  const isFetching = activeTab === "all" ? listInfinite.isFetching : typeQuery.isFetching;
  const isFetchingNextPage = listInfinite.isFetchingNextPage;
  const hasNextPage = activeTab === "all" ? listInfinite.hasNextPage : false;

  const handleSelect = (id: number) => {
    useGameStore.getState().selectPokemon(slot, id);
    pickerDialogHandle.close();
  };

  const prefetchPokemon = useDebouncedCallback(
    (id: number) => {
      queryClient
        .ensureQueryData(pokemonRetrieveOptions({ path: { id: String(id) } }))
        .then((data) => {
          queryClient.prefetchQuery(pokemonSpeciesRetrieveOptions({ path: { id: data.species.name } }));
        })
        .catch(() => {
          /* ignore prefetch errors */
        });
    },
    { wait: 150 },
  );

  const handleHover = async (id: number) => {
    setHoveredId(id);
    prefetchPokemon(id);
  };

  return (
    <>
      <div className="modal-head">
        <input
          className="modal-search"
          id="modal-search"
          type="text"
          placeholder={m.home_search_placeholder()}
          value={searchQuery}
          onChange={(e) => useGameStore.getState().setSearchQuery(e.currentTarget.value)}
        />
        <Dialog.Close className="modal-close">
          <XIcon />
        </Dialog.Close>
      </div>
      <TypesTabs value={activeTab} onValueChange={(v) => useGameStore.getState().setActiveTab(v)} />
      <div className="modal-body">
        <div className="poke-grid-wrap">
          {isInitialLoading ? (
            <div className="poke-grid-loading">
              <div className="spinner" />
              <span>{m.preview_loading()}</span>
            </div>
          ) : currentList && currentList.length > 0 ? (
            <div className="poke-grid-container">
              {isFetching && !isFetchingNextPage && (
                <div className="poke-grid-overlay">
                  <div className="spinner" />
                </div>
              )}
              <div className="poke-grid" id="poke-grid">
                {currentList.map((p) => (
                  <PokeThumb
                    key={p.id}
                    id={p.id}
                    name={p.name}
                    onHover={() => handleHover(p.id)}
                    onClick={() => handleSelect(p.id)}
                    translatedName={localizedNameCache.get(p.id)?.get(pokemonLanguage) || p.name}
                  />
                ))}
              </div>
              {hasNextPage && (
                <div className="pagination" style={{ justifyContent: "center", gap: 12 }}>
                  <span className="page-info">
                    {m.modal_loaded_count({
                      count: String(allAccumulatedItems?.length ?? 0),
                      total: String(listInfinite.data?.pages[0]?.count ?? "?"),
                    })}
                  </span>
                  <button
                    type="button"
                    className="page-btn"
                    disabled={isFetchingNextPage}
                    onClick={() => listInfinite.fetchNextPage()}
                    style={{
                      width: "auto",
                      padding: "8px 24px",
                      fontSize: "13px",
                      fontFamily: "var(--font-m)",
                    }}
                  >
                    {isFetchingNextPage ? (
                      <>
                        <div className="spinner" style={{ width: 14, height: 14 }} />
                        &nbsp;{m.preview_loading()}
                      </>
                    ) : (
                      m.modal_load_more()
                    )}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="no-results" style={{ gridColumn: "1/-1" }}>
              {m.modal_no_results()}
            </div>
          )}
        </div>
        <PokemonPreview pokemonId={deferredHoveredId} onSelect={handleSelect} />
      </div>
    </>
  );
}

function PokeThumb({
  id,
  name,
  onHover,
  onClick,
  translatedName,
}: {
  id: number;
  name: string;
  onHover: () => void;
  onClick: () => void;
  translatedName: string;
}) {
  return (
    <button type="button" className="poke-thumb" onClick={onClick} onMouseEnter={onHover}>
      <img src={getSpriteUrl(id)} alt={name} loading="lazy" className="select-none" />
      <div className="pt-name">{translatedName}</div>
      <div className="pt-num">#{String(id).padStart(3, "0")}</div>
    </button>
  );
}

function TypesTabs({ value, onValueChange }: { value: string; onValueChange: (v: string) => void }) {
  const typeListQuery = useQuery(typeListOptions());

  return (
    <ToggleGroup
      className="tabs-bar"
      id="tabs-bar"
      value={[value]}
      onValueChange={(v) => onValueChange(v[0])}
      multiple={false}
    >
      {[{ name: "all" }, ...(typeListQuery.data?.results ?? [])].map((t) => {
        const c = TYPE_TAB_COLORS[t.name as keyof typeof TYPE_TAB_COLORS] || TYPE_TAB_COLORS.normal;
        const spriteUrl = t.name === "all" ? undefined : getTypeSpriteUrl(t.name);
        return (
          <Toggle
            key={t.name}
            className={cn(
              "tab-btn inline-flex items-center gap-2 rounded-full p-1 pr-4",
              "outline-accent outline-offset-3 focus-visible:outline-3",
              value === t.name && "active",
              t.name === "all" && "px-4",
            )}
            style={{
              background: c.bg,
              color: c.color,
              borderColor: c.border,
              outlineColor: c.border,
            }}
            value={t.name}
          >
            {spriteUrl && (
              <img
                src={spriteUrl}
                alt={t.name}
                className="size-5 rounded-md object-contain"
                style={{ display: "block" }}
              />
            )}
            {t.name === "all" ? m.modal_tab_all() : t.name}
          </Toggle>
        );
      })}
    </ToggleGroup>
  );
}
