import { cloudflare } from "@cloudflare/vite-plugin";
import { heyApiPlugin } from "@hey-api/vite-plugin";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./src/i18n/paraglide",
      strategy: ["cookie", "preferredLanguage", "baseLocale"],
    }),
    heyApiPlugin({ config: () => import("./openapi-ts.config.ts").then((m) => m.default) }),
    devtools(),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    tanstackStart({
      spa: {
        enabled: true,
      },
    }),
    react({ compiler: { logDiagnostics: true } }),
  ],
});
