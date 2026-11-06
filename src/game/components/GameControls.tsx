import { clamp, randomInt } from "es-toolkit/math";
import { Shuffle } from "lucide-react";
import { m } from "#/i18n/paraglide/messages.js";
import { GameActorContext, useGamePhase, useGameSend } from "../game-actor";
import type { Fighter } from "../prepare-battle";
import { randomSeed } from "../rng";
import { useGameStore, useSelectedFighters } from "../store";

/**
 * Botones que dependen de la fase de la partida: comenzar (selección), cancelar (carga),
 * reintentar/volver (error) y nueva batalla (resultado). Qué se puede hacer lo decide la máquina (`can()`).
 */
export function GameControls() {
  const send = useGameSend();
  const phase = useGamePhase();
  const selected = useSelectedFighters();
  // La máquina decide si START es válido (solo en `selection`) y hay dos luchadores elegidos.
  const canStart = GameActorContext.useSelector(
    (s) => selected !== null && s.can({ type: "battle.start", fighters: selected, seed: 0 }),
  );

  const startWith = (fighters: readonly [Fighter, Fighter]) => {
    // battle.start no se acepta en `loading`/`battle`: un doble clic no puede lanzar dos batallas.
    // La semilla la genera quien envía el evento; la máquina no tiene azar propio.
    send({ type: "battle.start", fighters, seed: randomSeed() });
  };

  const handleStartBattle = () => {
    if (selected) startWith(selected);
  };

  const randomBattle = () => {
    const store = useGameStore.getState();
    const baseLevel = randomInt(20, 80);
    const level1 = clamp(baseLevel + randomInt(-10, 10), 1, 100);
    const level2 = clamp(baseLevel + randomInt(-10, 10), 1, 100);
    const id1 = randomInt(1, 151);
    let id2 = randomInt(1, 151);
    while (id2 === id1) id2 = randomInt(1, 151);

    store.setLevel(0, level1);
    store.setLevel(1, level2);
    store.selectPokemon(0, id1);
    store.selectPokemon(1, id2);

    // Sin setTimeout: los luchadores viajan en el evento, la máquina hace el fetch.
    if (phase === "battle") send({ type: "battle.exit" });
    startWith([
      { id: id1, level: level1 },
      { id: id2, level: level2 },
    ]);
  };

  const goBackToSelection = () => send({ type: "battle.exit" });
  const retry = () => send({ type: "battle.retry" });

  const randomButton = (
    <button
      className="battle-btn random aspect-square size-12 shrink-0 justify-center self-center"
      type="button"
      onClick={randomBattle}
      title="Random battle"
    >
      <Shuffle size={20} />
    </button>
  );

  if (phase === "error") {
    return (
      <div className="battle-section flex items-center justify-center gap-3" role="alert">
        <span>{m.home_error_title()}</span>
        <button className="battle-btn" type="button" onClick={retry}>
          {m.home_error_retry()}
        </button>
        <button className="battle-btn" type="button" onClick={goBackToSelection}>
          {m.home_error_back()}
        </button>
      </div>
    );
  }

  if (phase === "result" || phase === "battle") {
    return (
      <div className="battle-section flex items-center justify-center gap-3">
        <button className="battle-btn" type="button" onClick={goBackToSelection}>
          {m.home_new_battle()}
        </button>
        {randomButton}
      </div>
    );
  }

  return (
    <div className="battle-section" id="battleSection">
      {phase === "loading" ? (
        <div className="battle-loading">
          <div className="spinner" />
          <span className="battle-loading-msg">{m.home_analyzing_moves()}</span>
          <button className="battle-btn" type="button" onClick={goBackToSelection}>
            {m.home_cancel()}
          </button>
        </div>
      ) : (
        <div className="battle-btns">
          <button className="battle-btn" id="battleBtn" disabled={!canStart} type="button" onClick={handleStartBattle}>
            {m.home_start_battle()}
          </button>
          {randomButton}
        </div>
      )}
    </div>
  );
}
