import { fromCallback } from "xstate";

/** Hecho del reloj: pasaron `dt` ms reales desde el tick anterior (nunca negativo). */
export type ClockTickEvent = { type: "clock.tick"; dt: number };

export const CLOCK_INTERVAL_MS = 16;

/**
 * Reloj compartido por las máquinas con tiempo (reproducción y efectos): envía `clock.tick { dt }` mientras
 * el actor esté vivo. Es el único sitio con tiempo real; las máquinas solo suman `dt`, así que son
 * deterministas y testeables proveyendo otro reloj (`machine.provide({ actors: { clock } })`).
 * Usa `performance.now()` (monotónico) y recorta `dt` a ≥ 0 por si acaso.
 */
export const clock = fromCallback<ClockTickEvent>(({ sendBack }) => {
  let last = performance.now();
  const id = setInterval(() => {
    const now = performance.now();
    sendBack({ type: "clock.tick", dt: Math.max(0, now - last) });
    last = now;
  }, CLOCK_INTERVAL_MS);
  return () => clearInterval(id);
});
