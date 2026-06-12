import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { ErrorScreen } from "./componentes/ErrorScreen";
import { NotFoundPage } from "./componentes/NotFoundPage";
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
    defaultPendingComponent: GameLoading,
    defaultErrorComponent: ErrorScreen,
    defaultNotFoundComponent: NotFoundPage,
    Wrap(props) {
      return <query.Provider>{props.children}</query.Provider>;
    },
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
