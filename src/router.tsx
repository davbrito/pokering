import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { GameLoading } from "./game/components/GameLoading";
import { getQueryContext } from "./integrations/tanstack-query/provider";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const query = getQueryContext();
  const router = createTanStackRouter({
    routeTree,

    context: { queryClient: query.queryClient },

    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    Wrap(props) {
      return <query.Provider>{props.children}</query.Provider>;
    },
    defaultPendingComponent: GameLoading,
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
