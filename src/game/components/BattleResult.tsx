import type { PokemonDetail } from "#/api/pokeapi/index.ts";
import { getArtworkUrl } from "../api";
import { getEffectiveness, getStatsObject } from "../combat";
import { useChosenPokemon, useGameStore } from "../store";
import type { PokemonStats } from "../types";
import { renderStepContent } from "./renderStepContent";

interface WinnerInfo {
  wp: PokemonDetail;
  lp: PokemonDetail;
  ws: PokemonStats;
  ls: PokemonStats;
  wt: number;
  lt: number;
  razon: string;
  analisis: string;
  winnerIdx: number;
}

function computeWinner(
  poke1: PokemonDetail,
  poke2: PokemonDetail,
  steps: { type: string; winnerIdx?: number; faintedIdx?: number }[],
): WinnerInfo {
  const lastStep = steps[steps.length - 1];
  const winnerIdx =
    lastStep.winnerIdx !== undefined
      ? lastStep.winnerIdx
      : lastStep.type === "faint"
        ? lastStep.faintedIdx === 0
          ? 1
          : 0
        : 0;
  const wp = winnerIdx === 0 ? poke1 : poke2;
  const lp = winnerIdx === 0 ? poke2 : poke1;
  const ws = winnerIdx === 0 ? getStatsObject(poke1) : getStatsObject(poke2);
  const ls = winnerIdx === 0 ? getStatsObject(poke2) : getStatsObject(poke1);
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
    razon = `La ventaja elemental de tipo de ${wp.name.toUpperCase()} desarmó por completo la defensa del contrincante.`;
  } else if (ws.spe > ls.spe && ws.spe - ls.spe >= 20) {
    razon = `Su superioridad de velocidad le otorgó la iniciativa de cada turno, sentenciando el combate.`;
  } else {
    razon = `La consistencia física y el poder acumulado de sus estadísticas de combate fueron arrolladores.`;
  }

  const analisis = `La arena de batalla presenció un combate de alto nivel entre ${poke1.name.toUpperCase()} y ${poke2.name.toUpperCase()}. ${
    hasElementalAdvantage
      ? `La ventaja elemental y de tipo estratégica del ganador le confirió el control de los daños en todo momento.`
      : `El ritmo del combate estuvo dictaminado por sutiles diferencias tácticas en las estadísticas de combate individuales.`
  } Finalmente, la contundencia coronó a ${wp.name.toUpperCase()} como el gladiador supremo de la contienda tras el simulacro cinematográfico.`;

  return { wp, lp, ws, ls, wt, lt, razon, analisis, winnerIdx };
}

const statKeys = ["hp", "atk", "def", "spa", "spd", "spe"] as const;
const statLabels = ["HP", "ATK", "DEF", "SpA", "SpD", "VEL"];

export function BattleResult() {
  const battlePhase = useGameStore((s) => s.battlePhase);
  const battleSteps = useGameStore((s) => s.battleSteps);
  const { chosen } = useChosenPokemon();

  if (battlePhase !== "result") return null;

  const p1 = chosen[0];
  const p2 = chosen[1];
  if (!p1 || !p2 || battleSteps.length === 0) return null;

  const w = computeWinner(p1, p2, battleSteps);
  const actionSteps = battleSteps.filter((s) => s.type === "action" || s.type === "faint");
  const wart = getArtworkUrl(w.wp);

  return (
    <div id="result-wrap" className="show">
      <div id="result-inner">
        <div className="result-card">
          <div className="result-top">
            <img className="win-art" src={wart} alt={w.wp.name} />
            <div>
              <div className="win-eyebrow">🏆 Ganador de la batalla</div>
              <div className="win-name">{w.wp.name}</div>
              <div className="win-reason">{w.razon}</div>
            </div>
            <div className="bst-box">
              <div className="bst-lbl">BST</div>
              <div className="bst-num">{w.wt}</div>
              <div className="bst-vs">vs {w.lt}</div>
            </div>
          </div>
          <div className="result-body">
            <p className="analysis">{w.analisis}</p>
            <div className="section-lbl">Registro de batalla</div>
            <div className="log-list">
              {actionSteps.map((step, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: Using index as key is acceptable here because the list is static and does not change order.
                <div key={`${step.type}-${i}`} className="log-item">
                  <span className="log-t">T{i + 1}</span>
                  <span>{renderStepContent(step, p1.name, p2.name)}</span>
                </div>
              ))}
            </div>
            <div className="cmp-wrap">
              <div className="section-lbl" style={{ color: "var(--blue)", marginBottom: ".8rem" }}>
                Comparativa · <span style={{ color: "var(--muted)" }}>{w.wp.name}</span> vs{" "}
                <span style={{ color: "var(--muted)" }}>{w.lp.name}</span>
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
