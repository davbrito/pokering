import handler from "@tanstack/react-start/server-entry";

const wellKnownPattern = new URLPattern({ pathname: "/.well-known/*" });

export default {
  async fetch(request, _env, _ctx) {
    if (wellKnownPattern.test(request.url)) {
      return new Response(null, { status: 404 });
    }

    return await handler.fetch(request);
  },
} satisfies ExportedHandler<Cloudflare.Env>;
