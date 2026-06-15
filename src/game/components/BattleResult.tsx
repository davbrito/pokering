import type { PokemonDetail } from "#/api/pokeapi/index.ts";
import { m } from "#/i18n/paraglide/messages.js";
import { getArtworkUrl } from "../api";
import { getEffectiveness, getStatsObject } from "../combat";
import { useSettingsStore } from "../settings-store";
import { useChosenPokemon, useGameStore } from "../store";
import type { BattleStep, PokemonStats } from "../types";
import { getPokemonName, PokemonName } from "./PokemonName";
import { RenderStepContent } from "./renderStepContent";

interface WinnerInfo {
  wp: PokemonDetail;
  lp: PokemonDetail;
  ws: PokemonStats;
  ls: PokemonStats;
  wl: number;
  ll: number;
  wt: number;
  lt: number;
  razon: string;
  analisis: string;
  winnerIdx: number;
}

function computeWinner(
  poke1: PokemonDetail,
  poke2: PokemonDetail,
  steps: BattleStep[],
  level1: number,
  level2: number,
): WinnerInfo {
  const lastStep = steps[steps.length - 1];
  const winnerIdx =
    lastStep.type === "end" ? lastStep.winnerIdx : lastStep.type === "faint" ? (lastStep.faintedIdx === 0 ? 1 : 0) : 0;
  const wp = winnerIdx === 0 ? poke1 : poke2;
  const lp = winnerIdx === 0 ? poke2 : poke1;
  const ws = winnerIdx === 0 ? getStatsObject(poke1) : getStatsObject(poke2);
  const ls = winnerIdx === 0 ? getStatsObject(poke2) : getStatsObject(poke1);
  const wl = winnerIdx === 0 ? level1 : level2;
  const ll = winnerIdx === 0 ? level2 : level1;
  const wt = Object.values(ws).reduce((a, b) => a + b, 0);
  const lt = Object.values(ls).reduce((a, b) => a + b, 0);
  const wpTypes = wp.types.map((t) => t.type.name);
  const lpTypes = lp.types.map((t) => t.type.name);

  let hasElementalAdvantage = false;
  for (const wt of wpTypes) {
    for (const lt of lpTypes) {
      if (getEffectiveness(wt, [lt]) > 1) hasElementalAdvantage = true;
    }
  }

  let razon: string;
  if (hasElementalAdvantage) {
    razon = m.result_reason_elemental({ name: wp.name.toUpperCase() });
  } else if (ws.spe > ls.spe && ws.spe - ls.spe >= 20) {
    razon = m.result_reason_speed();
  } else {
    razon = m.result_reason_stats();
  }

  const p1Upper = poke1.name.toUpperCase();
  const p2Upper = poke2.name.toUpperCase();
  const wpUpper = wp.name.toUpperCase();
  const analisis = hasElementalAdvantage
    ? m.result_analysis_advantage({ p1: p1Upper, p2: p2Upper })
    : m.result_analysis_no_advantage({ p1: p1Upper, p2: p2Upper, winner: wpUpper });

  return { wp, lp, ws, ls, wl, ll, wt, lt, razon, analisis, winnerIdx };
}

const statKeys = ["hp", "atk", "def", "spa", "spd", "spe"] as const;
const statLabels = ["HP", "ATK", "DEF", "SpA", "SpD", "VEL"];

export function BattleResult() {
  const battlePhase = useGameStore((s) => s.battle.phase);
  const battleSteps = useGameStore((s) => s.battle.logs);
  const { chosen } = useChosenPokemon();
  const level1 = useGameStore((s) => s.players.player1.level);
  const level2 = useGameStore((s) => s.players.player2.level);

  if (battlePhase !== "result") return null;

  const p1 = chosen[0];
  const p2 = chosen[1];
  if (!p1 || !p2 || battleSteps.length === 0) return null;

  const w = computeWinner(p1, p2, battleSteps, level1, level2);
  const actionSteps = battleSteps.filter((s) => s.type !== "start");
  const wart = getArtworkUrl(w.wp);

  return (
    <div id="result-wrap" className="show">
      <div id="result-inner">
        <div className="result-card">
          <div className="result-top">
            <img
              className="win-art"
              src={wart}
              alt={getPokemonName(w.wp, useSettingsStore.getState().pokemonLanguage)}
            />
            <div>
              <div className="win-eyebrow">{m.battle_winner_trophy()}</div>
              <div className="win-name">
                <PokemonName pokemon={w.wp} />
              </div>
              <div className="win-level">Nv. {w.wl}</div>
              <div className="win-reason">{w.razon}</div>
            </div>
            <div className="bst-box">
              <div className="bst-lbl">
                {m.battle_bst()} · Nv.{w.wl}
              </div>
              <div className="bst-num">{w.wt}</div>
              <div className="bst-vs">{m.battle_vs({ total: String(w.lt) })}</div>
            </div>
          </div>
          <div className="result-body">
            <p className="analysis">{w.analisis}</p>
            <div className="section-lbl">{m.battle_log_title()}</div>
            <div className="log-list">
              {actionSteps.map((step, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: Using index as key is acceptable here because the list is static and does not change order.
                <div key={`${step.type}-${i}`} className="log-item">
                  <span className="log-t">{m.battle_step_t({ turn: String(i + 1) })}</span>
                  <span>
                    <RenderStepContent step={step} p1Name={p1.name} p2Name={p2.name} />
                  </span>
                </div>
              ))}
            </div>
            <div className="cmp-wrap">
              <div className="section-lbl" style={{ color: "var(--blue)", marginBottom: ".8rem" }}>
                {m.battle_comparison({ name1: w.wp.name, name2: w.lp.name })}
              </div>
              {statKeys.map((key, i) => {
                const v1 = w.winnerIdx === 0 ? w.ws[key] : w.ls[key];
                const v2 = w.winnerIdx === 0 ? w.ls[key] : w.ws[key];
                const mx = Math.max(v1, v2, 1);
                const c1 = v1 >= v2 ? "#4ade80" : "#e63e3e";
                const c2 = v2 >= v1 ? "#4ade80" : "#e63e3e";
                const p1pct = Math.round((v1 / mx) * 100);
                const p2pct = Math.round((v2 / mx) * 100);
                return (
                  <div key={key} className="cmp-row">
                    <div className="cmp-left">
                      <span
                        style={{
                          fontSize: "10px",
                          fontFamily: "var(--font-m)",
                          color: c1,
                        }}
                      >
                        {v1}
                      </span>
                      <div
                        className="strack"
                        style={{
                          width: `${p1pct}%`,
                          maxWidth: "110px",
                          minWidth: "4px",
                        }}
                      >
                        <div className="sfill" style={{ width: "100%", background: c1 }} />
                      </div>
                    </div>
                    <div className="cmp-lbl">{statLabels[i]}</div>
                    <div className="cmp-right">
                      <div
                        className="strack"
                        style={{
                          width: `${p2pct}%`,
                          maxWidth: "110px",
                          minWidth: "4px",
                        }}
                      >
                        <div className="sfill" style={{ width: "100%", background: c2 }} />
                      </div>
                      <span
                        style={{
                          fontSize: "10px",
                          fontFamily: "var(--font-m)",
                          color: c2,
                        }}
                      >
                        {v2}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
