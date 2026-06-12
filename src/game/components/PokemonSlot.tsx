import { For, Show } from "solid-js";
import { getArtworkUrl } from "../api";
import { getStatsObject } from "../combat";
import { STAT_ABBR } from "../data";
import { chosen, chosenLoading, setActiveSlot, setModalOpen } from "../store";
import type { PokemonDetail } from "../types";

function PokemonCard(props: { pokemon: PokemonDetail }) {
  const d = () => props.pokemon;
  const art = () => getArtworkUrl(d());
  const types = () => d().types.map((t) => t.type.name);
  const stats = () => getStatsObject(d());
  const total = () => Object.values(stats()).reduce((a, b) => a + b, 0);

  return (
    <div class="poke-card show">
      <div class="poke-art-wrap">
        <img class="poke-art" src={art()} alt={d().name} />
      </div>
      <div class="poke-name">{d().name}</div>
      <div class="poke-sub">
        #{String(d().id).padStart(3, "0")} · {d().height / 10}m ·{" "}
        {d().weight / 10}kg · BST {total()}
      </div>
      <div class="types">
        <For each={types()}>
          {(t) => <span class={`tbadge t-${t}`}>{t}</span>}
        </For>
      </div>
      <div class="stats">
        <For each={d().stats}>
          {(s) => {
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
              <div class="srow">
                <span class="sname">{abbr}</span>
                <div class="strack">
                  <div
                    class="sfill"
                    style={{
                      width: `${pct}%`,
                      background: col,
                    }}
                  />
                </div>
                <span class="sval">{s.base_stat}</span>
              </div>
            );
          }}
        </For>
      </div>
      <Show when={d().flavor}>
        <p class="flavor">"{d().flavor}"</p>
      </Show>
    </div>
  );
}

export function PokemonSlot(props: { index: number; label: string }) {
  const p = () => chosen()[props.index];
  const loading = () => chosenLoading()[props.index];

  const openForSlot = () => {
    setActiveSlot(props.index);
    setModalOpen(true);
  };

  return (
    <div class={`slot${p() ? " filled" : ""}`} id={`slot${props.index}`}>
      <div class="slot-lbl">{props.label}</div>
      <button type="button" class="pick-btn" onClick={openForSlot}>
        <Show
          when={!loading() && p()}
          fallback={
            <Show
              when={loading()}
              fallback={
                <>
                  <span class="pb-icon">⊕</span> Seleccionar Pokémon
                </>
              }
            >
              <div class="spinner"></div> Cargando...
            </Show>
          }
        >
          <span class="pb-icon">✔</span> {p()?.name ?? ""} — cambiar
        </Show>
      </button>
      <Show when={p()}>{(pokemon) => <PokemonCard pokemon={pokemon()} />}</Show>
    </div>
  );
}
