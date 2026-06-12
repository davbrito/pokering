import {
  type Accessor,
  createEffect,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
import { fetchPokemonById, getArtworkUrl, getSpriteUrl } from "../api";
import { STAT_ABBR, TYPE_TAB_COLORS, TYPES } from "../data";
import {
  activeSlot,
  activeTab,
  allPokemon,
  loadTypeData,
  modalOpen,
  searchQuery,
  selectPokemon,
  setActiveTab,
  setModalOpen,
  setSearchQuery,
  setTypePokemon,
  typePokemon,
} from "../store";
import type { PokemonDetail } from "../types";

function PokemonPreview(props: { pokemonId: Accessor<number | null> }) {
  const [previewData, setPreviewData] = createSignal<PokemonDetail | null>(
    null,
  );
  const [loading, setLoading] = createSignal(false);
  let lastFetched = 0;

  createEffect(() => {
    const id = props.pokemonId();
    if (id === null || id === lastFetched) return;
    lastFetched = id;
    setLoading(true);
    setPreviewData(null);
    fetchPokemonById(id)
      .then((d) => setPreviewData(d))
      .catch(() => setPreviewData(null))
      .finally(() => setLoading(false));
  });

  return (
    <div class="preview-panel" id="preview-panel">
      <Show
        when={!loading() && previewData()}
        fallback={
          <Show
            when={loading()}
            fallback={
              <div class="preview-empty">
                <div class="pe-icon">👆</div>
                <div>Pasa el cursor sobre un Pokémon para verlo</div>
              </div>
            }
          >
            <div class="loading-bar">
              <div class="spinner"></div>
            </div>
          </Show>
        }
      >
        {(() => {
          const d = previewData();
          if (!d) return null;
          const art = getArtworkUrl(d);
          const types = d.types.map((t) => t.type.name);
          const total = d.stats.reduce((a, s) => a + s.base_stat, 0);
          return (
            <>
              <img class="prev-art" src={art} alt={d.name} />
              <div class="prev-name">{d.name}</div>
              <div class="prev-meta">
                #{String(d.id).padStart(3, "0")} · BST {total}
              </div>
              <div class="prev-types">
                <For each={types}>
                  {(t) => <span class={`tbadge t-${t}`}>{t}</span>}
                </For>
              </div>
              <div class="prev-stats">
                <For each={d.stats}>
                  {(s) => {
                    const abbr =
                      STAT_ABBR[s.stat.name] ||
                      s.stat.name.slice(0, 3).toUpperCase();
                    const pct = Math.round(
                      Math.min((s.base_stat / 180) * 100, 100),
                    );
                    const col =
                      s.base_stat >= 100
                        ? "#4ade80"
                        : s.base_stat >= 70
                          ? "#60d8a0"
                          : s.base_stat >= 45
                            ? "#f5c842"
                            : "#e63e3e";
                    return (
                      <div class="prev-srow">
                        <span class="prev-sname">{abbr}</span>
                        <div class="strack">
                          <div
                            class="sfill"
                            style={{
                              width: `${pct}%`,
                              background: col,
                            }}
                          />
                        </div>
                        <span
                          style={{
                            "font-size": "9px",
                            "font-family": "var(--font-m)",
                            color: "var(--text)",
                          }}
                        >
                          {s.base_stat}
                        </span>
                      </div>
                    );
                  }}
                </For>
              </div>
              <button
                type="button"
                class="prev-select-btn"
                onClick={() => {
                  selectPokemon(activeSlot(), d.name);
                  setModalOpen(false);
                }}
              >
                Elegir este ▶
              </button>
            </>
          );
        })()}
      </Show>
    </div>
  );
}

export function PokemonModal() {
  const [hoveredId, setHoveredId] = createSignal<number | null>(null);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") setModalOpen(false);
  };

  // Setup keyboard listener
  if (typeof document !== "undefined") {
    document.addEventListener("keydown", handleKeyDown);
    onCleanup(() => document.removeEventListener("keydown", handleKeyDown));
  }

  const filteredList = () => {
    const tab = activeTab();
    const q = searchQuery().toLowerCase().trim();
    let list = tab === "all" ? allPokemon() : typePokemon();

    if (!list.length && tab === "all") return [];
    if (q) {
      list = allPokemon().filter(
        (p) => p.name.includes(q) || String(p.id).padStart(3, "0").includes(q),
      );
    }
    return list;
  };

  const switchTabHandler = async (type: string) => {
    setActiveTab(type);
    if (type !== "all") {
      const data = await loadTypeData(type);
      setTypePokemon(data);
    }
  };

  return (
    <div class={`modal-overlay${modalOpen() ? " open" : ""}`}>
      <Show when={modalOpen()}>
        <button
          type="button"
          class="modal-overlay-bg"
          aria-label="Cerrar modal"
          onClick={() => setModalOpen(false)}
        />
      </Show>
      <div class="modal">
        <div class="modal-head">
          <input
            class="modal-search"
            id="modal-search"
            type="text"
            placeholder="Buscar por nombre o número..."
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
          />
          <button
            type="button"
            class="modal-close"
            onClick={() => setModalOpen(false)}
          >
            ✕
          </button>
        </div>

        {/* Type tabs */}
        <div class="tabs-bar" id="tabs-bar">
          <For each={TYPES}>
            {(t) => {
              const c = TYPE_TAB_COLORS[t] || TYPE_TAB_COLORS.normal;
              return (
                <button
                  type="button"
                  class={`tab-btn${activeTab() === t ? " active" : ""}`}
                  style={{
                    background: c.bg,
                    color: c.color,
                    "border-color": c.border,
                  }}
                  onClick={() => switchTabHandler(t)}
                >
                  {t === "all" ? "Todos" : t}
                </button>
              );
            }}
          </For>
        </div>

        <div class="modal-body">
          <div class="poke-grid-wrap">
            <Show
              when={filteredList().length > 0}
              fallback={
                <div class="no-results" style={{ "grid-column": "1/-1" }}>
                  No se encontraron Pokémon
                </div>
              }
            >
              <div class="poke-grid" id="poke-grid">
                <For each={filteredList().slice(0, 200)}>
                  {(p) => (
                    <button
                      type="button"
                      class="poke-thumb"
                      onClick={() => {
                        selectPokemon(activeSlot(), p.name);
                        setModalOpen(false);
                      }}
                      onMouseEnter={() => setHoveredId(p.id)}
                    >
                      <img
                        src={getSpriteUrl(p.id)}
                        alt={p.name}
                        loading="lazy"
                      />
                      <div class="pt-name">{p.name}</div>
                      <div class="pt-num">#{String(p.id).padStart(3, "0")}</div>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>

          <PokemonPreview pokemonId={hoveredId} />
        </div>
      </div>
    </div>
  );
}
