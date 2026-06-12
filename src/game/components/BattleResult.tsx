import { For, Show } from "solid-js";
import { getArtworkUrl } from "../api";
import { getEffectiveness, getStatsObject } from "../combat";
import { battlePhase, battleSteps, chosen } from "../store";

export function BattleResult() {
  const p1 = () => chosen()[0];
  const p2 = () => chosen()[1];

  const winnerData = () => {
    const steps = battleSteps();
    const poke1 = p1();
    const poke2 = p2();
    if (!poke1 || !poke2 || steps.length === 0) return null;
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

    let razon = "";
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

    return {
      wp,
      lp,
      ws,
      ls,
      wt,
      lt,
      razon,
      analisis,
      winnerIdx,
    };
  };

  const statKeys = ["hp", "atk", "def", "spa", "spd", "spe"] as const;
  const statLabels = ["HP", "ATK", "DEF", "SpA", "SpD", "VEL"];

  const actionSteps = () =>
    battleSteps().filter((s) => s.type === "action" || s.type === "faint");

  return (
    <Show when={battlePhase() === "result" && winnerData() !== null}>
      <Show when={winnerData()}>
        {(w) => {
          const data = w();
          const wart = getArtworkUrl(data.wp);
          return (
            <div id="result-wrap" class="show">
              <div id="result-inner">
                <div class="result-card">
                  <div class="result-top">
                    <img class="win-art" src={wart} alt={data.wp.name} />
                    <div>
                      <div class="win-eyebrow">🏆 Ganador de la batalla</div>
                      <div class="win-name">{data.wp.name}</div>
                      <div class="win-reason">{data.razon}</div>
                    </div>
                    <div class="bst-box">
                      <div class="bst-lbl">BST</div>
                      <div class="bst-num">{data.wt}</div>
                      <div class="bst-vs">vs {data.lt}</div>
                    </div>
                  </div>
                  <div class="result-body">
                    <p class="analysis">{data.analisis}</p>
                    <div class="section-lbl">Registro de batalla</div>
                    <div class="log-list">
                      <For each={actionSteps()}>
                        {(step, i) => (
                          <div class="log-item">
                            <span class="log-t">T{i() + 1}</span>
                            <span innerHTML={step.text} />
                          </div>
                        )}
                      </For>
                    </div>
                    <div class="cmp-wrap">
                      <div
                        class="section-lbl"
                        style={{
                          color: "var(--blue)",
                          "margin-bottom": ".8rem",
                        }}
                      >
                        Comparativa ·{" "}
                        <span style={{ color: "var(--muted)" }}>
                          {data.wp.name}
                        </span>{" "}
                        vs{" "}
                        <span style={{ color: "var(--muted)" }}>
                          {data.lp.name}
                        </span>
                      </div>
                      <For each={statKeys}>
                        {(key, i) => {
                          const v1 =
                            data.winnerIdx === 0 ? data.ws[key] : data.ls[key];
                          const v2 =
                            data.winnerIdx === 0 ? data.ls[key] : data.ws[key];
                          const mx = Math.max(v1, v2, 1);
                          const c1 = v1 >= v2 ? "#4ade80" : "#e63e3e";
                          const c2 = v2 >= v1 ? "#4ade80" : "#e63e3e";
                          const p1pct = Math.round((v1 / mx) * 100);
                          const p2pct = Math.round((v2 / mx) * 100);
                          return (
                            <div class="cmp-row">
                              <div class="cmp-left">
                                <span
                                  style={{
                                    "font-size": "10px",
                                    "font-family": "var(--font-m)",
                                    color: c1,
                                  }}
                                >
                                  {v1}
                                </span>
                                <div
                                  class="strack"
                                  style={{
                                    width: `${p1pct}%`,
                                    "max-width": "110px",
                                    "min-width": "4px",
                                  }}
                                >
                                  <div
                                    class="sfill"
                                    style={{
                                      width: "100%",
                                      background: c1,
                                    }}
                                  />
                                </div>
                              </div>
                              <div class="cmp-lbl">{statLabels[i()]}</div>
                              <div class="cmp-right">
                                <div
                                  class="strack"
                                  style={{
                                    width: `${p2pct}%`,
                                    "max-width": "110px",
                                    "min-width": "4px",
                                  }}
                                >
                                  <div
                                    class="sfill"
                                    style={{
                                      width: "100%",
                                      background: c2,
                                    }}
                                  />
                                </div>
                                <span
                                  style={{
                                    "font-size": "10px",
                                    "font-family": "var(--font-m)",
                                    color: c2,
                                  }}
                                >
                                  {v2}
                                </span>
                              </div>
                            </div>
                          );
                        }}
                      </For>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        }}
      </Show>
    </Show>
  );
}
