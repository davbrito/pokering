import type { PokemonDetail } from "#/api/pokeapi/index.ts";
import { getArtworkUrl } from "../api";
import { getStatsObject } from "../combat";
import { STAT_ABBR } from "../data";
import { useGame, useGameActions } from "../store";

function PokemonCard({ pokemon }: { pokemon: PokemonDetail }) {
  const d = pokemon;
  const art = getArtworkUrl(d);
  const types = d.types.map((t) => t.type.name);
  const stats = getStatsObject(d);
  const total = Object.values(stats).reduce((a, b) => a + b, 0);

  return (
    <div className="poke-card show">
      <div className="poke-art-wrap">
        <img className="poke-art" src={art} alt={d.name} />
      </div>
      <div className="poke-name">{d.name}</div>
      <div className="poke-sub">
        #{String(d.id).padStart(3, "0")} · {d.height! / 10}m · {d.weight! / 10}
        kg · BST {total}
      </div>
      <div className="types">
        {types.map((t) => (
          <span key={t} className={`tbadge t-${t}`}>
            {t}
          </span>
        ))}
      </div>
      <div className="stats">
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
            <div key={s.stat.name} className="srow">
              <span className="sname">{abbr}</span>
              <div className="strack">
                <div
                  className="sfill"
                  style={{ width: `${pct}%`, background: col }}
                />
              </div>
              <span className="sval">{s.base_stat}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PokemonSlot({
  index,
  label,
}: {
  index: number;
  label: string;
}) {
  const { chosen, chosenLoading } = useGame();
  const { setActiveSlot, setModalOpen } = useGameActions();

  const pokemon = chosen[index];
  const loading = chosenLoading[index];

  const openForSlot = () => {
    setActiveSlot(index);
    setModalOpen(true);
  };

  return (
    <div className={`slot${pokemon ? " filled" : ""}`} id={`slot${index}`}>
      <div className="slot-lbl">{label}</div>
      <button type="button" className="pick-btn" onClick={openForSlot}>
        {!loading && pokemon ? (
          <>
            <span className="pb-icon">✔</span> {pokemon.name} — cambiar
          </>
        ) : loading ? (
          <div className="spinner" />
        ) : (
          <>
            <span className="pb-icon">⊕</span> Seleccionar Pokémon
          </>
        )}
      </button>
      {pokemon && <PokemonCard pokemon={pokemon} />}
    </div>
  );
}
