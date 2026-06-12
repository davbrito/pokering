import handler from "@tanstack/react-start/server-entry";
import { paraglideMiddleware } from "./i18n/paraglide/server.js";

const wellKnownPattern = new URLPattern({ pathname: "/.well-known/*" });

export default {
  async fetch(request, env, ctx) {
    if (wellKnownPattern.test(request.url)) {
      return new Response(null, { status: 404 });
    }

    return paraglideMiddleware(request, ({ locale }) =>
      handler.fetch(request, {
        context: { locale, env, executionContext: ctx },
      }),
    );
  },
} satisfies ExportedHandler<Cloudflare.Env>;

interface ServerRequestContext {
  locale: string;
  env: Cloudflare.Env;
  executionContext: ExecutionContext;
}

declare module "@tanstack/react-router" {
  interface Register {
    server: {
      requestContext: ServerRequestContext;
    };
  }
}
