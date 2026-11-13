import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createActor, setup } from "xstate";
import { CLOCK_INTERVAL_MS, type ClockTickEvent, clock } from "#/game/clock.ts";

describe("clock", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function run() {
    const dts: number[] = [];
    const machine = setup({
      types: { events: {} as ClockTickEvent },
      actors: { clock },
    }).createMachine({
      invoke: { src: "clock" },
      on: { "clock.tick": { actions: ({ event }) => dts.push(event.dt) } },
    });
    const actor = createActor(machine).start();
    return { actor, dts };
  }

  it("envía el tiempo real transcurrido entre ticks", () => {
    const now = vi.spyOn(performance, "now");
    now.mockReturnValue(1000);
    const { dts } = run();
    now.mockReturnValue(1016);
    vi.advanceTimersByTime(CLOCK_INTERVAL_MS);
    now.mockReturnValue(1050); // el navegador retrasó el tick
    vi.advanceTimersByTime(CLOCK_INTERVAL_MS);
    expect(dts).toEqual([16, 34]);
  });

  it("nunca envía dt negativo", () => {
    const now = vi.spyOn(performance, "now");
    now.mockReturnValue(5000);
    const { dts } = run();
    now.mockReturnValue(100); // el reloj salta hacia atrás
    vi.advanceTimersByTime(CLOCK_INTERVAL_MS);
    expect(dts).toEqual([0]);
  });

  it("al detener el actor deja de latir", () => {
    const { actor, dts } = run();
    actor.stop();
    vi.advanceTimersByTime(1000);
    expect(dts).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
