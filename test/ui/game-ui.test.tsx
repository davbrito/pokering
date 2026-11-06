import { fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INTRO_DELAY_MS } from "#/game/playback-machine.ts";
import type { PrepareBattleInput } from "#/game/prepare-battle.ts";
import { m } from "#/i18n/paraglide/messages.js";
import { advance, chooseFighters, deferred, prepared, renderGame, resetSelection } from "./harness.tsx";

// Semillas conocidas y distintas: lo que distingue a Revancha (semilla nueva) de Reintentar (la misma).
vi.mock("#/game/rng.ts", async (original) => {
  let n = 100;
  return { ...(await original<typeof import("#/game/rng.ts")>()), randomSeed: () => ++n };
});

// El audio usa elementos <audio>, que jsdom no implementa.
vi.mock("#/game/audio.ts", () => ({ playPokemonCries: vi.fn(), playPokemonCry: vi.fn() }));

const phase = () => screen.getByTestId("phase").textContent;
const click = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
const button = (name: string) => screen.getByRole("button", { name }) as HTMLButtonElement;

beforeEach(() => {
  vi.useFakeTimers();
  resetSelection();
});
afterEach(() => vi.useRealTimers());

/** Lleva la partida hasta `playback` ya fuera de la intro. */
async function startPlaying(prepare = vi.fn(async (_input: PrepareBattleInput) => prepared)) {
  renderGame(prepare);
  chooseFighters();
  await advance();
  click(m.home_start_battle());
  await advance(); // resuelve prepareBattle
  await advance(INTRO_DELAY_MS);
  return prepare;
}

describe("UI según el estado de la máquina", () => {
  describe("selection", () => {
    it("«Comenzar batalla» está deshabilitado sin dos luchadores y habilitado con ellos", async () => {
      renderGame(async () => prepared);
      expect(phase()).toBe("selection");
      expect(button(m.home_start_battle()).disabled).toBe(true);

      chooseFighters();
      await advance();
      expect(button(m.home_start_battle()).disabled).toBe(false);
    });
  });

  describe("loading", () => {
    it("muestra el spinner y «Cancelar» vuelve a la selección", async () => {
      const pending = deferred<typeof prepared>();
      renderGame(() => pending.promise);
      chooseFighters();
      await advance();
      click(m.home_start_battle());
      await advance();

      expect(phase()).toBe("loading");
      expect(screen.getByText(m.home_analyzing_moves())).toBeTruthy();
      expect(screen.queryByRole("button", { name: m.home_start_battle() })).toBeNull();

      click(m.home_cancel());
      await advance();
      expect(phase()).toBe("selection");
      expect(button(m.home_start_battle())).toBeTruthy();
    });
  });

  describe("error", () => {
    it("«Reintentar» repite la carga con la misma semilla", async () => {
      const prepare = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValue(prepared);
      renderGame(prepare);
      chooseFighters();
      await advance();
      click(m.home_start_battle());
      await advance();

      expect(phase()).toBe("error");
      expect(screen.getByRole("alert").textContent).toContain(m.home_error_title());

      click(m.home_error_retry());
      await advance();
      expect(prepare).toHaveBeenCalledTimes(2);
      expect(prepare.mock.calls[1][0].seed).toBe(prepare.mock.calls[0][0].seed);
      expect(phase()).toBe("battle");
    });

    it("«Volver» regresa a la selección", async () => {
      renderGame(vi.fn().mockRejectedValue(new Error("boom")));
      chooseFighters();
      await advance();
      click(m.home_start_battle());
      await advance();
      expect(phase()).toBe("error");

      click(m.home_error_back());
      await advance();
      expect(phase()).toBe("selection");
    });
  });

  describe("battle", () => {
    it("la pausa está deshabilitada durante la intro (la velocidad sí se acepta) y se habilita al empezar", async () => {
      renderGame(async () => prepared);
      chooseFighters();
      await advance();
      click(m.home_start_battle());
      await advance();

      expect(phase()).toBe("battle");
      expect(button("Pausa").disabled).toBe(true);
      expect(button("Velocidad 1x").disabled).toBe(false);

      await advance(INTRO_DELAY_MS);
      expect(button("Pausa").disabled).toBe(false);
    });

    it("refleja la pausa y la velocidad del actor de reproducción", async () => {
      await startPlaying();

      click("Pausa");
      await advance();
      expect(button("Reanudar")).toBeTruthy();

      click("Velocidad 1x");
      await advance();
      expect(button("Velocidad 2x")).toBeTruthy();

      click("Reanudar");
      await advance();
      expect(button("Pausa")).toBeTruthy();
    });

    it("«Saltar» lleva al resultado", async () => {
      await startPlaying();
      click("Saltar");
      await advance();
      expect(phase()).toBe("result");
    });
  });

  describe("result", () => {
    it("muestra el ganador y «Revancha» vuelve a cargar con otra semilla y los mismos luchadores", async () => {
      const prepare = await startPlaying();
      click("Saltar");
      await advance();

      expect(phase()).toBe("result");
      expect(screen.getByText(m.battle_winner_trophy())).toBeTruthy();
      // Ganó el luchador 0 (bulbasaur, id 1)
      expect(screen.getByRole("img", { name: /bulbasaur/i })).toBeTruthy();

      click(m.battle_rematch());
      await advance();
      expect(prepare).toHaveBeenCalledTimes(2);
      expect(prepare.mock.calls[1][0].fighters).toEqual(prepare.mock.calls[0][0].fighters);
      expect(prepare.mock.calls[1][0].seed).not.toBe(prepare.mock.calls[0][0].seed);
      expect(phase()).toBe("battle");
    });
  });
});
