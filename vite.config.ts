import { cloudflare } from "@cloudflare/vite-plugin";
import { heyApiPlugin } from "@hey-api/vite-plugin";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const POKEAPI_SCHEMA_URL = "https://raw.githubusercontent.com/PokeAPI/pokeapi/refs/heads/master/openapi.yml";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    paraglideVitePlugin({ project: "./project.inlang", outdir: "./src/i18n/paraglide" }),
    heyApiPlugin({
      config: {
        input: POKEAPI_SCHEMA_URL,
        output: "src/api/pokeapi",
        plugins: ["@tanstack/react-query"],
      },
    }),
    devtools(),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    tanstackStart({
      spa: {
        enabled: true,
      },
    }),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
});
