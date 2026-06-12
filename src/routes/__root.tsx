import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { Suspense } from "react";

import { GameProvider } from "../game/store";
import styleCss from "../styles.css?url";

export const Route = createRootRouteWithContext()({
  head: () => ({
    meta: [
      { charSet: "UTF-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1.0" },
      { title: "PokeRing — Simulador de Batalla" },
    ],
    links: [
      {
        href: "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600&family=Space+Mono:wght@700&display=swap",
        rel: "stylesheet",
      },
      { rel: "stylesheet", href: styleCss },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <html lang="es">
      <head>
        <HeadContent />
      </head>
      <body>
        <GameProvider>
          <Suspense>
            <Outlet />
            <TanStackRouterDevtools />
          </Suspense>
        </GameProvider>
        <Scripts />
      </body>
    </html>
  );
}
