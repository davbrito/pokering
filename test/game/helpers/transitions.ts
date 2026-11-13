import { type AdjacencyMap, getAdjacencyMap, toDirectedGraph } from "@xstate/graph";
import type { AnyEventObject, AnyMachineSnapshot, AnyStateMachine } from "xstate";

/** Transición declarada en la máquina: `fuente --evento--> destino` (sin destino = solo acciones). */
export interface DeclaredTransition {
  source: string;
  eventType: string;
  target: string | null;
}

export const describeTransition = (t: DeclaredTransition) =>
  `${t.source} --${t.eventType}--> ${t.target ?? "(sin cambio de estado)"}`;

/** Todas las transiciones declaradas, leídas del grafo dirigido de la máquina. */
export function declaredTransitions(machine: AnyStateMachine): DeclaredTransition[] {
  const result: DeclaredTransition[] = [];
  const visit = (node: ReturnType<typeof toDirectedGraph>) => {
    for (const edge of node.edges) {
      result.push({
        source: edge.source.id,
        eventType: edge.transition.eventType,
        target: edge.target && edge.target !== edge.source ? edge.target.id : null,
      });
    }
    node.children.forEach(visit);
  };
  visit(toDirectedGraph(machine));
  return result;
}

const matchesEventType = (pattern: string, type: string) =>
  pattern === type || (pattern.endsWith(".*") && type.startsWith(pattern.slice(0, -1)));

const inState = (snapshot: AnyMachineSnapshot, id: string) => [...snapshot._nodes].some((n) => n.id === id);

/**
 * Explora el espacio de estados con `@xstate/graph` y devuelve las transiciones declaradas que ningún camino
 * recorre. Una transición con destino cuenta cuando se pasa de un estado que contiene `source` a uno que
 * contiene `target`; una sin destino, cuando el evento se acepta (`can`) estando en `source`.
 *
 * Limitación: `can` también es true si el evento lo acepta *otra* transición del estado (una del padre o una rama
 * con otro guard), así que una transición sin destino puede darse por cubierta sin que se recorra esa rama.
 * Más precisión exigiría comparar `context` o los `actions` del microstep.
 */
export function uncoveredTransitions(
  machine: AnyStateMachine,
  events: (snapshot: AnyMachineSnapshot) => readonly AnyEventObject[],
  options: {
    input?: unknown;
    /** Qué distingue dos estados al explorar. Por defecto solo `value`; añade lo mínimo del contexto que haga falta. */
    key?: (snapshot: AnyMachineSnapshot) => unknown;
  } = {},
): DeclaredTransition[] {
  const adjacency: AdjacencyMap<AnyMachineSnapshot, AnyEventObject> = getAdjacencyMap(machine, {
    input: options.input,
    events,
    // Solo el valor de estado: el contexto (ids, tiempos acumulados) haría el espacio infinito.
    serializeState: (snapshot) => JSON.stringify(options.key?.(snapshot) ?? snapshot.value) as never,
  });
  const edges = Object.values(adjacency).flatMap((from) =>
    (Object.values(from.transitions) as { event: AnyEventObject; state: AnyMachineSnapshot }[]).map((t) => ({
      from: from.state,
      event: t.event,
      to: t.state,
    })),
  );
  return declaredTransitions(machine).filter(
    (declared) =>
      !edges.some(
        ({ from, event, to }) =>
          matchesEventType(declared.eventType, event.type) &&
          inState(from, declared.source) &&
          (declared.target === null ? from.can(event) : inState(to, declared.target)),
      ),
  );
}
